import { db, Order, OrderItem, Invoice, Payment, Customer } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';

const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'] as const;
const VALID_PAYMENTS = ['pending', 'authorized', 'paid', 'failed', 'refunded'] as const;

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
    } = data;

    if (!customerName || !customerPhone || !items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Customer name, phone number, and at least one dining item are required.', 400);
    }

    const state = db.getState();

    if (!state.settings.orderAcceptanceEnabled) {
      throw new AppError('We are currently not accepting new online orders. Please call our front desk directly.', 403);
    }

    const verifiedItems: OrderItem[] = [];
    let calculatedSubtotal = 0;

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
      const itemTotal = dish.price * qty;
      calculatedSubtotal += itemTotal;

      verifiedItems.push({
        dishId: dish.id,
        name: dish.name,
        price: dish.price,
        quantity: qty,
        total: itemTotal,
        image: dish.image,
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

    const { orderNumber, invoiceNumber } = generateOrderNumber();
    const now = new Date().toISOString();
    const orderId = 'ord_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const initialPaymentStatus = paymentMethod === 'online' ? 'paid' : 'pending';

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim() : undefined,
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
      notes: notes ? notes.trim() : undefined,
      statusHistory: [
        {
          status: 'pending',
          timestamp: now,
          actor: 'Customer Order Portal',
          note: `Order placed via ${fulfillmentType.toUpperCase()} with ${paymentMethod.toUpperCase()}`,
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
      paymentMethod: newOrder.paymentMethod,
      paymentStatus: initialPaymentStatus,
      transactionDate: now,
      gatewayTransactionReference: paymentMethod === 'online' ? `razor_${Date.now()}` : undefined,
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

    return { order: newOrder, invoice: newInvoice };
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

    const now = new Date().toISOString();
    let updatedOrder: Order | null = null;

    db.updateState((s) => {
      const target = s.orders.find((o) => o.id === orderId);
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

    if (!updatedOrder) {
      throw new AppError('Order not found.', 404);
    }

    db.logAudit('ORDER_STATUS_CHANGED', actor, `Order ${(updatedOrder as Order).orderNumber} status changed to ${status}`);
    return updatedOrder;
  },

  async updateOrderPayment(orderId: string, paymentStatus: string, collectedBy?: string, actor = 'Staff') {
    if (!paymentStatus || !VALID_PAYMENTS.includes(paymentStatus as any)) {
      throw new AppError(`Invalid payment status. Allowed: ${VALID_PAYMENTS.join(', ')}`, 400);
    }

    let updatedOrder: Order | null = null;

    db.updateState((s) => {
      const target = s.orders.find((o) => o.id === orderId);
      if (target) {
        target.paymentStatus = paymentStatus as any;
        target.updatedAt = new Date().toISOString();
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
