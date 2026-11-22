import { db, Order, OrderItem, Invoice, Payment, Customer } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';
import { eventBus, DOMAIN_EVENTS } from '../../events/eventBus.js';

const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'] as const;
const VALID_PAYMENTS = ['pending', 'authorized', 'paid', 'failed', 'refunded', 'awaiting_verification'] as const;

function generateOrderNumber(): { orderNumber: string; invoiceNumber: string } {
  const currentYear = new Date().getFullYear();
  const existingCount = db.getState().orders.length + 1001;
  const orderNumber = `HST-${currentYear}-${existingCount}`;
  const invoiceNumber = `HST-INV-${existingCount}`;
  return { orderNumber, invoiceNumber };
}

export const ordersService = {
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
      idempotencyKey,
    } = data;

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
    const verifiedItems: OrderItem[] = [];
    let calculatedSubtotalPaise = 0;

    for (const requestedItem of items) {
      const dish = state.dishes.find(
        (d) => d.id === requestedItem.dishId || d.id === requestedItem.id || d.slug === requestedItem.dishId || d.slug === requestedItem.id
      );
      if (!dish) {
        throw new AppError(`Dish with ID '${requestedItem.dishId || requestedItem.id}' not found in active menu.`, 400);
      }
      if (!dish.available) {
        throw new AppError(`'${dish.name}' is currently sold out and unavailable. Please update your tray.`, 400);
      }

      const qty = Math.max(1, parseInt(requestedItem.quantity, 10) || 1);
      const priceInPaise = Math.round(dish.price * 100);
      const itemTotalPaise = priceInPaise * qty;
      calculatedSubtotalPaise += itemTotalPaise;

      verifiedItems.push({
        dishId: dish.id,
        name: dish.name,
        price: dish.price,
        priceInPaise,
        quantity: qty,
        total: itemTotalPaise / 100,
        totalInPaise: itemTotalPaise,
        image: dish.image,
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

    const discountInPaise = 0;
    const discountAmount = 0;

    const grandTotalPaise = calculatedSubtotalPaise + taxInPaise + deliveryInPaise - discountInPaise;
    const grandTotal = grandTotalPaise / 100;

    const { orderNumber, invoiceNumber } = generateOrderNumber();
    const now = new Date().toISOString();
    const orderId = 'ord_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    // 4. Server-Side Payment Rule: Online and UPI payments ALWAYS start as 'pending'
    const initialPaymentStatus = 'pending';

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      idempotencyKey,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim() : undefined,
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
      grandTotal,
      grandTotalInPaise: grandTotalPaise,
      paymentMethod: ['online', 'cod', 'upi'].includes(paymentMethod) ? paymentMethod : 'cod',
      paymentStatus: initialPaymentStatus,
      orderStatus: 'pending',
      notes: notes ? notes.trim() : undefined,
      statusHistory: [
        {
          status: 'pending',
          timestamp: now,
          actor: 'Customer Order Portal',
          note: `Order placed via ${fulfillmentType.toUpperCase()} with payment method ${paymentMethod.toUpperCase()}`,
        },
      ],
      invoiceNumber,
      createdAt: now,
      updatedAt: now,
    };

    const newInvoice: Invoice = {
      id: 'inv_' + Date.now(),
      invoiceNumber,
      orderId,
      orderNumber,
      customerName: newOrder.customerName,
      customerPhone: newOrder.customerPhone,
      customerAddress: newOrder.deliveryAddress,
      items: verifiedItems,
      subtotal: calculatedSubtotal,
      taxAmount,
      deliveryCharge,
      discountAmount,
      grandTotal,
      paymentMethod: newOrder.paymentMethod,
      paymentStatus: initialPaymentStatus,
      issuedAt: now,
    };

    const newPayment: Payment = {
      id: 'pay_' + Date.now(),
      paymentReference: `PAY_${orderNumber}`,
      orderId,
      orderNumber,
      amount: grandTotal,
      amountInPaise: grandTotalPaise,
      paymentMethod: newOrder.paymentMethod,
      paymentStatus: initialPaymentStatus,
      transactionDate: now,
      idempotencyKey,
    };

    db.updateState((s) => {
      s.orders.unshift(newOrder);
      s.invoices.unshift(newInvoice);
      s.payments.unshift(newPayment);

      const existingCust = s.customers.find((c) => c.phone.replace(/\D/g, '') === customerPhone.replace(/\D/g, ''));
      if (existingCust) {
        existingCust.totalOrders += 1;
        existingCust.totalSpent += grandTotal;
        existingCust.lastOrderDate = now;
        if (!existingCust.email && customerEmail) existingCust.email = customerEmail;
      } else {
        const newCust: Customer = {
          id: 'cust_' + Date.now(),
          name: customerName.trim(),
          phone: customerPhone.trim(),
          email: customerEmail ? customerEmail.trim() : undefined,
          totalOrders: 1,
          totalSpent: grandTotal,
          lastOrderDate: now,
          createdAt: now,
        };
        s.customers.unshift(newCust);
      }
    });

    db.logAudit('ORDER_PLACED', 'Customer', `Order ${orderNumber} placed for ₹${grandTotal} by ${customerName}`);

    // Emit domain event for order creation
    eventBus.emitEvent(DOMAIN_EVENTS.ORDER_CREATED, {
      order: newOrder,
      invoice: newInvoice,
      payment: newPayment,
    });

    return { order: newOrder, invoice: newInvoice, payment: newPayment };
  },

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

    let orders = [...db.getState().orders];

    if (search) {
      const q = String(search).toLowerCase();
      orders = orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q) ||
          o.invoiceNumber.toLowerCase().includes(q)
      );
    }

    if (orderStatus && orderStatus !== 'all') {
      orders = orders.filter((o) => o.orderStatus === orderStatus);
    }

    if (paymentStatus && paymentStatus !== 'all') {
      orders = orders.filter((o) => o.paymentStatus === paymentStatus);
    }

    if (fulfillmentType && fulfillmentType !== 'all') {
      orders = orders.filter((o) => o.fulfillmentType === fulfillmentType);
    }

    if (startDate) {
      orders = orders.filter((o) => o.createdAt >= String(startDate));
    }

    if (endDate) {
      orders = orders.filter((o) => o.createdAt <= String(endDate) + 'T23:59:59.999Z');
    }

    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = orders.slice(startIndex, startIndex + limitNum);

    return {
      total: orders.length,
      page: pageNum,
      totalPages: Math.ceil(orders.length / limitNum),
      orders: paginated,
    };
  },

  async getOrderDetails(id: string) {
    const state = db.getState();
    const order = state.orders.find((o) => o.id === id || o.orderNumber === id);
    if (!order) {
      throw new AppError('Order not found.', 404);
    }
    const payment = state.payments.find((p) => p.orderId === order.id);
    const invoice = state.invoices.find((i) => i.orderId === order.id);

    return { order, payment, invoice };
  },

  async updateOrderStatus(orderId: string, status: string, note?: string, actor = 'Staff') {
    if (!status || !VALID_STATUSES.includes(status as any)) {
      throw new AppError(`Invalid order status. Allowed: ${VALID_STATUSES.join(', ')}`, 400);
    }

    const state = db.getState();
    const existing = state.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!existing) {
      throw new AppError('Order not found.', 404);
    }

    if (existing.orderStatus === 'cancelled') {
      throw new AppError('Cannot update status of an already cancelled order.', 400);
    }

    if (existing.orderStatus === 'completed') {
      throw new AppError('Cannot update status of an already completed order.', 400);
    }

    const previousStatus = existing.orderStatus;
    const now = new Date().toISOString();
    let updatedOrder: Order | null = null;

    db.updateState((s) => {
      const target = s.orders.find((o) => o.id === existing.id);
      if (target) {
        target.orderStatus = status as any;
        target.updatedAt = now;
        target.statusHistory.push({
          status,
          timestamp: now,
          actor,
          note: note ? String(note).trim() : `Status changed to ${status.toUpperCase()}`,
        });
        updatedOrder = { ...target };
      }
    });

    db.logAudit('ORDER_STATUS_CHANGED', actor, `Order ${existing.orderNumber} status changed from ${previousStatus} to ${status}`);

    eventBus.emitEvent(DOMAIN_EVENTS.ORDER_STATUS_CHANGED, {
      order: updatedOrder,
      previousStatus,
      newStatus: status,
      actor,
    });

    return updatedOrder;
  },

  async cancelOrder(orderId: string, reason: string, actor = 'Customer', isCustomer = true) {
    const state = db.getState();
    const targetOrder = state.orders.find((o) => o.id === orderId || o.orderNumber === orderId);

    if (!targetOrder) {
      throw new AppError('Order not found.', 404);
    }

    if (targetOrder.orderStatus === 'cancelled') {
      throw new AppError('This order is already cancelled.', 400);
    }

    if (targetOrder.orderStatus === 'completed') {
      throw new AppError('Delivered or completed orders cannot be cancelled.', 400);
    }

    // Customer cancellation grace period check: only allowed during pending or confirmed
    if (isCustomer && ['preparing', 'ready_for_pickup', 'out_for_delivery'].includes(targetOrder.orderStatus)) {
      throw new AppError(
        'Cancellation unavailable. Kitchen has already started preparing your food. Please contact front desk.',
        400
      );
    }

    const now = new Date().toISOString();
    let cancelledOrder: Order | null = null;

    db.updateState((s) => {
      const target = s.orders.find((o) => o.id === targetOrder.id);
      if (target) {
        target.orderStatus = 'cancelled';
        target.cancellationReason = reason || 'Customer requested cancellation';
        target.cancelledAt = now;
        target.cancelledBy = actor;
        target.updatedAt = now;
        target.statusHistory.push({
          status: 'cancelled',
          timestamp: now,
          actor,
          note: `Order cancelled. Reason: ${target.cancellationReason}`,
        });
        cancelledOrder = { ...target };
      }
    });

    db.logAudit('ORDER_CANCELLED', actor, `Order ${targetOrder.orderNumber} cancelled. Reason: ${reason}`);

    eventBus.emitEvent(DOMAIN_EVENTS.ORDER_CANCELLED, {
      order: cancelledOrder,
      actor,
      reason,
    });

    return cancelledOrder;
  },

  async handlePaymentPaidEvent(payload: { payment: Payment; actor?: string; gatewayTxn?: string }): Promise<Order | null> {
    const { payment, actor = 'Payment Gateway' } = payload;
    const now = new Date().toISOString();
    let updatedOrder: Order | null = null;

    db.updateState((s) => {
      const order = s.orders.find((o) => o.id === payment.orderId || o.orderNumber === payment.orderNumber);
      if (order) {
        const previousStatus = order.orderStatus;
        order.paymentStatus = 'paid';
        order.updatedAt = now;

        // Auto-advance online/UPI pending orders to confirmed upon payment capture
        if (order.orderStatus === 'pending') {
          order.orderStatus = 'confirmed';
        }

        order.statusHistory.push({
          status: order.orderStatus,
          timestamp: now,
          actor,
          note: `Payment of ₹${payment.amount} verified and captured. Order confirmed and sent to kitchen.`,
        });

        updatedOrder = { ...order };

        // Synchronize invoice
        const invoice = s.invoices.find((i) => i.orderId === order.id);
        if (invoice) {
          invoice.paymentStatus = 'paid';
        }
      }
    });

    if (updatedOrder) {
      eventBus.emitEvent(DOMAIN_EVENTS.ORDER_STATUS_CHANGED, {
        order: updatedOrder,
        previousStatus: 'pending',
        newStatus: (updatedOrder as Order).orderStatus,
        actor,
      });
    }

    return updatedOrder;
  },

  async updateOrderPayment(orderId: string, paymentStatus: string, collectedBy?: string, actor = 'Staff') {
    if (!paymentStatus || !VALID_PAYMENTS.includes(paymentStatus as any)) {
      throw new AppError(`Invalid payment status. Allowed: ${VALID_PAYMENTS.join(', ')}`, 400);
    }

    let updatedOrder: Order | null = null;
    const now = new Date().toISOString();

    db.updateState((s) => {
      const target = s.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (target) {
        target.paymentStatus = paymentStatus as any;
        target.updatedAt = now;
        updatedOrder = { ...target };

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

    if (!updatedOrder) {
      throw new AppError('Order not found.', 404);
    }

    db.logAudit('PAYMENT_STATUS_CHANGED', actor, `Order ${(updatedOrder as Order).orderNumber} payment marked as ${paymentStatus}`);
    return updatedOrder;
  },
};
