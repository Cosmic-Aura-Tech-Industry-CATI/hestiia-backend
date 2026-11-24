import mongoose from 'mongoose';
import { Order, type IOrderDocument } from './order.model.js';
import { MenuItem } from '../menu/menu.model.js';
import { customersService } from '../customers/customers.service.js';
import { db, type Invoice, type Payment } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';
import { eventBus, DOMAIN_EVENTS } from '../../events/eventBus.js';
import type { IOrderItem } from './orders.interface.js';
import { offersService } from '../offers/services/offers.service.js';
import { discountCalculationService } from '../offers/services/discountCalculation.service.js';

const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'] as const;
const VALID_PAYMENTS = ['pending', 'authorized', 'paid', 'failed', 'refunded', 'awaiting_verification'] as const;

export const ordersService = {
  /**
   * Format order document for clean API response
   */
  formatOrder(doc: any) {
    const id = doc?._id ? doc._id.toString() : (doc?.id || '');
    return {
      id,
      _id: doc?._id || id,
      orderNumber: doc?.orderNumber || '',
      idempotencyKey: doc?.idempotencyKey,
      customerName: doc?.customerName || '',
      customerPhone: doc?.customerPhone || '',
      customerEmail: doc?.customerEmail || undefined,
      deliveryAddress: doc?.deliveryAddress || '',
      fulfillmentType: doc?.fulfillmentType || 'delivery',
      items: (doc?.items || []).map((item: any) => ({
        dishId: item?.dishId ? item.dishId.toString() : '',
        name: item?.name || '',
        price: item?.price ?? 0,
        quantity: item?.quantity ?? 1,
        total: item?.total ?? 0,
        totalInPaise: item?.totalInPaise,
        image: item?.image || '/uploads/menu/default-dish.webp',
      })),
      subtotal: doc?.subtotal ?? 0,
      subtotalInPaise: doc?.subtotalInPaise,
      taxAmount: doc?.taxAmount ?? 0,
      taxInPaise: doc?.taxInPaise,
      deliveryCharge: doc?.deliveryCharge ?? 0,
      deliveryInPaise: doc?.deliveryInPaise,
      discountAmount: doc?.discountAmount ?? 0,
      discount: doc?.discountAmount ?? doc?.discount ?? 0,
      discountInPaise: doc?.discountInPaise,
      offer: doc?.offer || null,
      grandTotal: doc?.grandTotal ?? 0,
      grandTotalInPaise: doc?.grandTotalInPaise,
      paymentMethod: doc?.paymentMethod || 'cod',
      paymentStatus: doc?.paymentStatus || 'pending',
      orderStatus: doc?.orderStatus || 'pending',
      notes: doc?.notes || '',
      statusHistory: (doc?.statusHistory || []).map((sh: any) => ({
        status: sh?.status || '',
        timestamp: sh?.timestamp || new Date(),
        actor: sh?.actor || 'System',
        note: sh?.note || '',
      })),
      invoiceNumber: doc?.invoiceNumber || '',
      createdAt: doc?.createdAt || new Date(),
      updatedAt: doc?.updatedAt || new Date(),
    };
  },

  /**
   * Helper to lookup order document by MongoDB ObjectId or orderNumber
   */
  async findOrderDoc(idOrNumber: string) {
    if (!idOrNumber) return null;
    const clean = idOrNumber.trim();
    if (mongoose.connection.readyState === 1) {
      try {
        if (mongoose.Types.ObjectId.isValid(clean)) {
          const byId = await Order.findById(clean);
          if (byId) return byId;
        }
        const byNum = await Order.findOne({
          $or: [
            { orderNumber: clean },
            { invoiceNumber: clean },
          ],
        });
        if (byNum) return byNum;
      } catch {}
    }
    const state = db.getState();
    const found = (state.orders || []).find(
      (o: any) => o.id === clean || o._id === clean || o.orderNumber === clean || o.invoiceNumber === clean
    );
    return found || null;
  },

  /**
   * 1. Place New Order (Direct MongoDB Atlas insertion with real-time dish price verification)
   */
  async createOrder(data: any) {
    const customerName = data.customerName || data.customer?.name;
    const customerPhone = data.customerPhone || data.customer?.phone;
    const customerEmail = data.customerEmail || data.customer?.email;
    const deliveryAddress = data.deliveryAddress || data.customer?.address || 'Dining In';
    const fulfillmentType = data.fulfillmentType || 'dining';
    const items = data.items;
    const paymentMethod = data.paymentMethod || 'cod';
    const notes = data.notes;
    const idempotencyKey = data.idempotencyKey;

    if (!customerName || !customerPhone || !items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Customer name, phone number, and at least one dining item are required.', 400);
    }

    const state = db.getState();

    // 1. Idempotency Check: Prevent duplicate orders on network retries
    if (idempotencyKey) {
      const existingOrder = state.orders.find((o) => o.idempotencyKey === idempotencyKey);
      if (existingOrder) {
        const existingInvoice = state.invoices.find((i) => i.orderId === existingOrder.id);
        const existingPayment = state.payments.find((p) => p.orderId === existingOrder.id);
        return { order: existingOrder, invoice: existingInvoice, payment: existingPayment, isIdempotentReplay: true };
      }
    }

    if (!state.settings.orderAcceptanceEnabled) {
      throw new AppError('We are currently not accepting new online orders. Please call our front desk directly.', 403);
    }

    // 2. Strict Menu Verification & Integer Paise Snapshot
    const verifiedItems: IOrderItem[] = [];
    let calculatedSubtotalPaise = 0;

    // Verify dishes and pricing directly from MongoDB Atlas MenuItem collection
    for (const requestedItem of items) {
      const itemId = String(requestedItem.dishId || requestedItem.id || '').trim();
      if (!itemId) {
        throw new AppError('Invalid dish ID in order items.', 400);
      }

      let dish: any = null;
      if (mongoose.connection.readyState === 1) {
        try {
          if (mongoose.Types.ObjectId.isValid(itemId)) {
            dish = await MenuItem.findById(itemId).lean();
          }

          if (!dish) {
            dish = await MenuItem.findOne({
              $or: [
                { slug: itemId },
                { name: { $regex: new RegExp(`^${itemId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } },
              ],
            }).lean();
          }
        } catch {}
      }

      if (!dish) {
        dish = (state.dishes || []).find(
          (d: any) =>
            String(d.id || d._id) === itemId ||
            d.slug === itemId ||
            (d.name && d.name.toLowerCase() === itemId.toLowerCase())
        );
      }

      if (!dish) {
        throw new AppError(`Dish with identifier '${itemId}' not found in active restaurant menu.`, 400);
      }
      if (!dish.available) {
        throw new AppError(`'${dish.name}' is currently sold out and unavailable. Please update your tray.`, 400);
      }

      const qty = Math.max(1, parseInt(requestedItem.quantity, 10) || 1);
      const priceInPaise = Math.round(dish.price * 100);
      const itemTotalPaise = priceInPaise * qty;
      calculatedSubtotalPaise += itemTotalPaise;

      verifiedItems.push({
        dishId: dish._id ? dish._id.toString() : dish.id,
        name: dish.name,
        price: dish.price,
        priceInPaise,
        quantity: qty,
        total: itemTotalPaise / 100,
        totalInPaise: itemTotalPaise,
        image: dish.image || '/uploads/menu/default-dish.webp',
      });
    }

    const calculatedSubtotal = calculatedSubtotalPaise / 100;

    if (fulfillmentType === 'delivery' && calculatedSubtotal < state.settings.minOrderValue) {
      throw new AppError(
        `Minimum order value for home delivery is ₹${state.settings.minOrderValue}. Your current subtotal is ₹${calculatedSubtotal}.`,
        400
      );
    }

    // 3. Integer Arithmetic for Financial Integrity (paise)
    const taxRatePercent = state.settings.taxRatePercent || 5;
    const taxInPaise = Math.round((calculatedSubtotalPaise * taxRatePercent) / 100);
    const taxAmount = taxInPaise / 100;

    const deliveryInPaise = fulfillmentType === 'delivery' ? Math.round((state.settings.deliveryFee || 0) * 100) : 0;
    const deliveryCharge = deliveryInPaise / 100;

    let discountAmount = 0;
    let discountInPaise = 0;
    let offerSnapshot: any = null;

    const requestedOfferId = data.offerId || data.appliedOffer?.offerId;
    if (requestedOfferId) {
      const offer = await offersService.getOfferById(requestedOfferId);
      const check = discountCalculationService.isOfferAvailable(offer);
      if (!check.available) {
        throw new AppError(`Applied offer is not valid: ${check.reason}`, 400);
      }
      const calc = discountCalculationService.calculateDiscount(offer, calculatedSubtotal);
      discountAmount = calc.discountAmount;
      discountInPaise = Math.round(discountAmount * 100);
      offerSnapshot = {
        offerId: offer._id,
        title: offer.title,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        discountAmount,
      };
    }

    const grandTotalPaise = Math.max(0, calculatedSubtotalPaise + taxInPaise + deliveryInPaise - discountInPaise);
    const grandTotal = grandTotalPaise / 100;

    // Auto-generate unique order number based on database count
    const currentYear = new Date().getFullYear();
    let totalOrderCount = (state.orders || []).length;
    if (mongoose.connection.readyState === 1) {
      try {
        totalOrderCount = await Order.countDocuments();
      } catch {}
    }
    const sequence = totalOrderCount + 1001;
    const orderNumber = `HST-${currentYear}-${sequence}`;
    const invoiceNumber = `HST-INV-${sequence}`;
    const now = new Date();
    // Online and UPI payments always start as pending until a payment gateway verifies them.
    const initialPaymentStatus = 'pending';

    const orderDocData = {
      orderNumber,
      idempotencyKey,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim().toLowerCase() : undefined,
      deliveryAddress: deliveryAddress ? deliveryAddress.trim() : fulfillmentType === 'dine-in' ? 'Dine-In Table' : 'Pickup Counter',
      fulfillmentType: ['dine-in', 'pickup', 'delivery'].includes(fulfillmentType) ? fulfillmentType : 'delivery',
      items: verifiedItems,
      subtotal: calculatedSubtotal,
      subtotalInPaise: calculatedSubtotalPaise,
      taxAmount,
      taxInPaise,
      deliveryCharge,
      deliveryInPaise,
      discountAmount,
      discountInPaise,
      offer: offerSnapshot,
      grandTotal,
      grandTotalInPaise: grandTotalPaise,
      paymentMethod: ['online', 'cod', 'upi'].includes(paymentMethod) ? paymentMethod : 'cod',
      paymentStatus: initialPaymentStatus as any,
      orderStatus: 'pending' as any,
      notes: notes ? String(notes).trim() : '',
      statusHistory: [
        {
          status: 'pending',
          timestamp: now,
          actor: 'Customer Order Portal',
          note: `Order placed via ${fulfillmentType.toUpperCase()} with payment method ${paymentMethod.toUpperCase()}`,
        },
      ],
      invoiceNumber,
    };

    let formattedOrder: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const createdOrder = await Order.create(orderDocData);
        formattedOrder = this.formatOrder((createdOrder as any).toJSON());
      } catch (err: any) {
        console.warn('[OrdersService] MongoDB order insertion fallback:', err?.message);
      }
    }

    if (!formattedOrder) {
      const generatedId = new mongoose.Types.ObjectId().toHexString();
      const localOrder = {
        ...orderDocData,
        _id: generatedId,
        id: generatedId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      formattedOrder = this.formatOrder(localOrder);
    }

    // 2. Synchronize customer profile directly in MongoDB Atlas Customer collection
    customersService
      .recordOrderForCustomer({
        name: formattedOrder.customerName,
        phone: formattedOrder.customerPhone,
        email: formattedOrder.customerEmail,
        address: formattedOrder.deliveryAddress,
        orderTotal: grandTotal,
      })
      .catch(() => {});

    // 3. Keep in-memory store synchronized for legacy modules (invoices, payments, dashboard)
    const newInvoice: Invoice = {
      id: 'inv_' + Date.now(),
      invoiceNumber,
      orderId: formattedOrder.id,
      orderNumber,
      customerName: formattedOrder.customerName,
      customerPhone: formattedOrder.customerPhone,
      customerAddress: formattedOrder.deliveryAddress,
      items: verifiedItems,
      subtotal: calculatedSubtotal,
      taxAmount,
      deliveryCharge,
      discountAmount,
      grandTotal,
      paymentMethod: formattedOrder.paymentMethod,
      paymentStatus: initialPaymentStatus,
      issuedAt: now.toISOString(),
    };

    const newPayment: Payment = {
      id: 'pay_' + Date.now(),
      paymentReference: `PAY_${orderNumber}`,
      orderId: formattedOrder.id,
      orderNumber,
      amount: grandTotal,
      amountInPaise: grandTotalPaise,
      paymentMethod: formattedOrder.paymentMethod,
      paymentStatus: initialPaymentStatus,
      transactionDate: now.toISOString(),
      idempotencyKey,
      gatewayTransactionReference: paymentMethod === 'online' ? `razor_${Date.now()}` : undefined,
    };

    db.updateState((s) => {
      s.orders.unshift(formattedOrder as any);
      s.invoices.unshift(newInvoice);
      s.payments.unshift(newPayment);
    });

    db.logAudit('ORDER_PLACED', 'Customer', `Order ${orderNumber} placed for ₹${grandTotal} by ${customerName}`);

    // Emit domain event for order creation
    eventBus.emitEvent(DOMAIN_EVENTS.ORDER_CREATED, {
      order: formattedOrder,
      invoice: newInvoice,
      payment: newPayment,
    });

    if (paymentMethod === 'cod' && offerSnapshot && discountAmount > 0) {
      offersService.recordRedemption({
        offerId: offerSnapshot.offerId,
        orderId: orderNumber,
        discountAmount,
        orderSubtotal: calculatedSubtotal,
      }).catch(() => {});
    }

    return { order: formattedOrder, invoice: newInvoice, payment: newPayment };
  },

  /**
   * 2. Get Admin Orders (Optimized lean query with filtering, search & pagination)
   */
  async getAdminOrders(query: any) {
    const {
      search,
      orderStatus,
      paymentStatus,
      fulfillmentType,
      startDate,
      endDate,
      page = '1',
      limit = '20',
    } = query;

    const filter: any = {};

    if (search && String(search).trim()) {
      const q = String(search).trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      filter.$or = [
        { orderNumber: { $regex: q, $options: 'i' } },
        { customerName: { $regex: q, $options: 'i' } },
        { customerPhone: { $regex: q, $options: 'i' } },
        { invoiceNumber: { $regex: q, $options: 'i' } },
      ];
    }

    if (orderStatus && orderStatus !== 'all') {
      filter.orderStatus = orderStatus;
    }

    if (paymentStatus && paymentStatus !== 'all') {
      filter.paymentStatus = paymentStatus;
    }

    if (fulfillmentType && fulfillmentType !== 'all') {
      filter.fulfillmentType = fulfillmentType;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return {
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      orders: orders.map((o) => this.formatOrder(o)),
    };
  },

  /**
   * 3. Get Single Order Details (with payment & invoice synchronization)
   */
  async getOrderDetails(id: string) {
    const orderDoc = await this.findOrderDoc(id);
    if (!orderDoc) {
      throw new AppError('Order not found.', 404);
    }

    const formattedOrder = this.formatOrder(orderDoc);
    const state = db.getState();
    const payment = state.payments.find((p) => p.orderId === formattedOrder.id || p.orderNumber === formattedOrder.orderNumber);
    const invoice = state.invoices.find((i) => i.orderId === formattedOrder.id || i.orderNumber === formattedOrder.orderNumber);

    return {
      order: formattedOrder,
      payment: payment || null,
      invoice: invoice || null,
    };
  },

  /**
   * 4. Update Order Status
   */
  async updateOrderStatus(orderId: string, status: string, note?: string, actor = 'Staff') {
    if (!status || !VALID_STATUSES.includes(status as any)) {
      throw new AppError(`Invalid order status. Allowed values: ${VALID_STATUSES.join(', ')}`, 400);
    }

    const orderDoc = await this.findOrderDoc(orderId);
    if (!orderDoc) {
      throw new AppError('Order not found.', 404);
    }
    if (orderDoc.orderStatus === 'cancelled') {
      throw new AppError('Cannot update status of an already cancelled order.', 400);
    }
    if (orderDoc.orderStatus === 'completed') {
      throw new AppError('Cannot update status of an already completed order.', 400);
    }

    const now = new Date();
    const newStatusEntry = {
      status,
      timestamp: now,
      actor,
      note: note ? String(note).trim() : `Status changed to ${status.toUpperCase()}`,
    };

    const updated = await Order.findByIdAndUpdate(
      (orderDoc as any)._id || orderDoc.id,
      {
        $set: { orderStatus: status },
        $push: { statusHistory: newStatusEntry },
      },
      { returnDocument: 'after' }
    ).lean();

    if (!updated) {
      throw new AppError('Order update failed.', 500);
    }

    const formatted = this.formatOrder(updated);

    // Sync in-memory store
    db.updateState((s) => {
      const target = s.orders.find((o) => o.id === formatted.id || o.orderNumber === formatted.orderNumber);
      if (target) {
        target.orderStatus = status as any;
        target.updatedAt = now.toISOString();
        target.statusHistory.push(newStatusEntry as any);
      }
    });

    db.logAudit('ORDER_STATUS_CHANGED', actor, `Order ${formatted.orderNumber} status changed to ${status}`);

    eventBus.emitEvent(DOMAIN_EVENTS.ORDER_STATUS_CHANGED, {
      order: updated,
      previousStatus: orderDoc.orderStatus,
      newStatus: status,
      actor,
    });

    return formatted;
  },

  async handlePaymentPaidEvent(payload: { payment: Payment; actor?: string; gatewayTxn?: string }) {
    const { payment, actor = 'Payment Gateway' } = payload;
    const orderDoc = await this.findOrderDoc(payment.orderId || payment.orderNumber);
    if (!orderDoc) return null;

    const now = new Date();
    const previousStatus = orderDoc.orderStatus;
    const nextStatus = orderDoc.orderStatus === 'pending' ? 'confirmed' : orderDoc.orderStatus;
    let updated: any = null;

    if (mongoose.connection.readyState === 1) {
      try {
        updated = await Order.findByIdAndUpdate(
          (orderDoc as any)._id || orderDoc.id,
          {
            $set: {
              paymentStatus: 'paid',
              orderStatus: nextStatus,
              updatedAt: now,
            },
            $push: {
              statusHistory: {
                status: nextStatus,
                timestamp: now,
                actor,
                note: `Payment of ₹${payment.amount} verified and captured. Order confirmed and sent to kitchen.`,
              },
            },
          },
          { returnDocument: 'after' }
        ).lean();
      } catch {}
    }

    const formatted = this.formatOrder(updated || orderDoc);
    db.updateState((s) => {
      const target = s.orders.find((o) => o.id === formatted.id || o.orderNumber === formatted.orderNumber);
      if (target) {
        target.paymentStatus = 'paid';
        target.orderStatus = nextStatus as any;
        target.updatedAt = now.toISOString();
        if (!target.statusHistory) target.statusHistory = [];
        target.statusHistory.push({
          status: nextStatus,
          timestamp: now.toISOString(),
          actor,
          note: `Payment of ₹${payment.amount} verified and captured. Order confirmed and sent to kitchen.`,
        });
        const invoice = s.invoices.find((i) => i.orderId === target.id);
        if (invoice) invoice.paymentStatus = 'paid';
      }
    });
    eventBus.emitEvent(DOMAIN_EVENTS.ORDER_STATUS_CHANGED, {
      order: updated,
      previousStatus,
      newStatus: nextStatus,
      actor,
    });
    return formatted;
  },

  /**
   * Cancel an order while preserving MongoDB and legacy in-memory state
   */
  async cancelOrder(orderId: string, reason: string, actor = 'Customer', isCustomer = true) {
    const orderDoc = await this.findOrderDoc(orderId);
    if (!orderDoc) {
      throw new AppError('Order not found.', 404);
    }
    if (orderDoc.orderStatus === 'cancelled') {
      throw new AppError('This order is already cancelled.', 400);
    }
    if (orderDoc.orderStatus === 'completed') {
      throw new AppError('Delivered or completed orders cannot be cancelled.', 400);
    }
    if (isCustomer && ['preparing', 'ready_for_pickup', 'out_for_delivery'].includes(orderDoc.orderStatus)) {
      throw new AppError(
        'Cancellation unavailable. Kitchen has already started preparing your food. Please contact front desk.',
        400
      );
    }

    const now = new Date();
    const cancellationEntry = {
      status: 'cancelled',
      timestamp: now,
      actor,
      note: `Order cancelled. Reason: ${reason}`,
    };
    const updated = await Order.findByIdAndUpdate(
      (orderDoc as any)._id || orderDoc.id,
      {
        $set: {
          orderStatus: 'cancelled',
          cancellationReason: reason,
          cancelledAt: now,
          cancelledBy: actor,
        },
        $push: { statusHistory: cancellationEntry },
      },
      { returnDocument: 'after' }
    ).lean();
    if (!updated) {
      throw new AppError('Order cancellation failed.', 500);
    }

    const formatted = this.formatOrder(updated);
    db.updateState((s) => {
      const target = s.orders.find((o) => o.id === formatted.id || o.orderNumber === formatted.orderNumber);
      if (target) {
        target.orderStatus = 'cancelled';
        target.cancellationReason = reason;
        target.cancelledAt = now.toISOString();
        target.cancelledBy = actor;
        target.updatedAt = now.toISOString();
        target.statusHistory.push(cancellationEntry as any);
      }
    });
    db.logAudit('ORDER_CANCELLED', actor, `Order ${formatted.orderNumber} cancelled. Reason: ${reason}`);
    eventBus.emitEvent(DOMAIN_EVENTS.ORDER_CANCELLED, {
      order: updated,
      actor,
      reason,
    });
    return formatted;
  },

  /**
   * 5. Update Order Payment Status
   */
  async updateOrderPayment(orderId: string, paymentStatus: string, collectedBy?: string, actor = 'Staff') {
    if (!paymentStatus || !VALID_PAYMENTS.includes(paymentStatus as any)) {
      throw new AppError(`Invalid payment status. Allowed values: ${VALID_PAYMENTS.join(', ')}`, 400);
    }

    const orderDoc = await this.findOrderDoc(orderId);
    if (!orderDoc) {
      throw new AppError('Order not found.', 404);
    }

    const updated = await Order.findByIdAndUpdate(
      (orderDoc as any)._id || orderDoc.id,
      {
        $set: { paymentStatus },
      },
      { returnDocument: 'after' }
    ).lean();

    if (!updated) {
      throw new AppError('Order payment update failed.', 500);
    }

    const formatted = this.formatOrder(updated);

    // Sync in-memory state
    db.updateState((s) => {
      const target = s.orders.find((o) => o.id === formatted.id || o.orderNumber === formatted.orderNumber);
      if (target) {
        target.paymentStatus = paymentStatus as any;
        target.updatedAt = new Date().toISOString();

        const payment = s.payments.find((p) => p.orderId === target.id);
        if (payment) {
          payment.paymentStatus = paymentStatus as any;
          if (collectedBy) payment.collectedBy = collectedBy;
        }
        const invoice = s.invoices.find((i) => i.orderId === target.id);
        if (invoice) {
          invoice.paymentStatus = paymentStatus as any;
        }
      }
    });

    db.logAudit('PAYMENT_STATUS_CHANGED', actor, `Order ${formatted.orderNumber} payment marked as ${paymentStatus}`);
    return formatted;
  },

  /**
   * 6. Track Order (Public customer lookup by order number)
   */
  async trackOrder(orderNumber: string) {
    const orderDoc = await this.findOrderDoc(orderNumber);
    if (!orderDoc) {
      throw new AppError(`No order found matching '${orderNumber}'.`, 404);
    }
    return this.formatOrder(orderDoc);
  },
};
