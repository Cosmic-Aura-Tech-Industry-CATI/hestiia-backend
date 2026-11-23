import mongoose from 'mongoose';
import { Order, type IOrderDocument } from './order.model.js';
import { MenuItem } from '../menu/menu.model.js';
import { customersService } from '../customers/customers.service.js';
import { db, type Invoice, type Payment } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';
import type { IOrderItem } from './orders.interface.js';

const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'] as const;
const VALID_PAYMENTS = ['pending', 'authorized', 'paid', 'failed', 'refunded'] as const;

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
        image: item?.image || '/uploads/menu/default-dish.webp',
      })),
      subtotal: doc?.subtotal ?? 0,
      taxAmount: doc?.taxAmount ?? 0,
      deliveryCharge: doc?.deliveryCharge ?? 0,
      discountAmount: doc?.discountAmount ?? 0,
      grandTotal: doc?.grandTotal ?? 0,
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
    if (mongoose.Types.ObjectId.isValid(idOrNumber)) {
      const byId = await Order.findById(idOrNumber);
      if (byId) return byId;
    }
    return Order.findOne({
      $or: [
        { orderNumber: idOrNumber.trim() },
        { invoiceNumber: idOrNumber.trim() },
      ],
    });
  },

  /**
   * 1. Place New Order (Direct MongoDB Atlas insertion with real-time dish price verification)
   */
  async createOrder(data: any) {
    const {
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      fulfillmentType = 'delivery',
      items,
      paymentMethod = 'cod',
      notes,
    } = data;

    if (!customerName || !customerPhone || !items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Customer name, phone number, and at least one dining item are required.', 400);
    }

    const state = db.getState();

    if (!state.settings.orderAcceptanceEnabled) {
      throw new AppError('We are currently not accepting new online orders. Please call our front desk directly.', 403);
    }

    const verifiedItems: IOrderItem[] = [];
    let calculatedSubtotal = 0;

    // Verify dishes and pricing directly from MongoDB Atlas MenuItem collection
    for (const requestedItem of items) {
      const itemId = String(requestedItem.dishId || requestedItem.id || '').trim();
      if (!itemId) {
        throw new AppError('Invalid dish ID in order items.', 400);
      }

      let dish: any = null;
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

      if (!dish) {
        throw new AppError(`Dish with identifier '${itemId}' not found in active restaurant menu.`, 400);
      }
      if (!dish.available) {
        throw new AppError(`'${dish.name}' is currently sold out and unavailable. Please update your tray.`, 400);
      }

      const qty = Math.max(1, parseInt(String(requestedItem.quantity), 10) || 1);
      const itemTotal = dish.price * qty;
      calculatedSubtotal += itemTotal;

      verifiedItems.push({
        dishId: dish._id ? dish._id.toString() : dish.id,
        name: dish.name,
        price: dish.price,
        quantity: qty,
        total: itemTotal,
        image: dish.image || '/uploads/menu/default-dish.webp',
      });
    }

    if (fulfillmentType === 'delivery' && calculatedSubtotal < state.settings.minOrderValue) {
      throw new AppError(
        `Minimum order value for home delivery is ₹${state.settings.minOrderValue}. Your current subtotal is ₹${calculatedSubtotal}.`,
        400
      );
    }

    const taxRate = state.settings.taxRatePercent / 100;
    const taxAmount = Math.round(calculatedSubtotal * taxRate);
    const deliveryCharge = fulfillmentType === 'delivery' ? state.settings.deliveryFee : 0;
    const discountAmount = 0;
    const grandTotal = calculatedSubtotal + taxAmount + deliveryCharge - discountAmount;

    // Auto-generate unique order number based on database count
    const currentYear = new Date().getFullYear();
    const totalOrderCount = await Order.countDocuments();
    const sequence = totalOrderCount + 1001;
    const orderNumber = `HST-${currentYear}-${sequence}`;
    const invoiceNumber = `HST-INV-${sequence}`;
    const now = new Date();
    const initialPaymentStatus = paymentMethod === 'online' ? 'paid' : 'pending';

    // 1. Persist directly in MongoDB Atlas
    const createdOrder = await Order.create({
      orderNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim().toLowerCase() : undefined,
      deliveryAddress: deliveryAddress ? deliveryAddress.trim() : fulfillmentType === 'dine-in' ? 'Dine-In Table' : 'Pickup Counter',
      fulfillmentType: ['dine-in', 'pickup', 'delivery'].includes(fulfillmentType) ? fulfillmentType : 'delivery',
      items: verifiedItems,
      subtotal: calculatedSubtotal,
      taxAmount,
      deliveryCharge,
      discountAmount,
      grandTotal,
      paymentMethod: ['online', 'cod', 'upi'].includes(paymentMethod) ? paymentMethod : 'cod',
      paymentStatus: initialPaymentStatus,
      orderStatus: 'pending',
      notes: notes ? String(notes).trim() : '',
      statusHistory: [
        {
          status: 'pending',
          timestamp: now,
          actor: 'Customer Order Portal',
          note: `Order placed via ${fulfillmentType.toUpperCase()} with ${paymentMethod.toUpperCase()}`,
        },
      ],
      invoiceNumber,
    });

    const formattedOrder = this.formatOrder(createdOrder.toJSON());

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
      paymentMethod: formattedOrder.paymentMethod,
      paymentStatus: initialPaymentStatus,
      transactionDate: now.toISOString(),
      gatewayTransactionReference: paymentMethod === 'online' ? `razor_${Date.now()}` : undefined,
    };

    db.updateState((s) => {
      s.orders.unshift(formattedOrder as any);
      s.invoices.unshift(newInvoice);
      s.payments.unshift(newPayment);
    });

    db.logAudit('ORDER_PLACED', 'Customer', `Order ${orderNumber} placed for ₹${grandTotal} by ${customerName}`);

    return { order: formattedOrder, invoice: newInvoice };
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

    const now = new Date();
    const newStatusEntry = {
      status,
      timestamp: now,
      actor,
      note: note ? String(note).trim() : `Status changed to ${status.toUpperCase()}`,
    };

    const updated = await Order.findByIdAndUpdate(
      orderDoc._id,
      {
        $set: { orderStatus: status },
        $push: { statusHistory: newStatusEntry },
      },
      { new: true }
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
      orderDoc._id,
      {
        $set: { paymentStatus },
      },
      { new: true }
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
