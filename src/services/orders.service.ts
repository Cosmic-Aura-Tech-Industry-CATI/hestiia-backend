import { AppError } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';
import { logAudit } from '@/lib/audit';
import { escapeRegex } from '@/lib/regex';
import { DishModel } from '@/models/Dish.model';
import { IOrder, IOrderItem, OrderModel } from '@/models/Order.model';
import { IInvoice, InvoiceModel } from '@/models/Invoice.model';
import { IPayment, PaymentModel } from '@/models/Payment.model';
import { CustomerModel } from '@/models/Customer.model';
import { settingsService } from './settings.service';
import { cleanDoc, cleanDocs } from '@/models/_schema';

const VALID_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'completed',
  'cancelled',
] as const;
const VALID_PAYMENTS = ['pending', 'authorized', 'paid', 'failed', 'refunded'] as const;

async function generateOrderNumber(): Promise<{
  orderNumber: string;
  invoiceNumber: string;
}> {
  const currentYear = new Date().getFullYear();
  let seq = (await OrderModel.countDocuments()) + 1001;
  while (await OrderModel.exists({ orderNumber: `HST-${currentYear}-${seq}` })) {
    seq += 1;
  }
  return {
    orderNumber: `HST-${currentYear}-${seq}`,
    invoiceNumber: `HST-INV-${seq}`,
  };
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
      throw new AppError(
        'Customer name, phone number, and at least one dining item are required.',
        400
      );
    }

    await connectDB();
    const settings = await settingsService.getAdminSettings();

    if (!settings.orderAcceptanceEnabled) {
      throw new AppError(
        'We are currently not accepting new online orders. Please call our front desk directly.',
        403
      );
    }

    const identifiers = items
      .map((i: any) => i.dishId || i.id)
      .filter(Boolean)
      .map(String);

    const dishes = await DishModel.find({
      $or: [{ id: { $in: identifiers } }, { slug: { $in: identifiers } }],
    }).lean();

    const verifiedItems: IOrderItem[] = [];
    let calculatedSubtotal = 0;

    for (const requestedItem of items) {
      const lookup = requestedItem.dishId || requestedItem.id;
      const dish = dishes.find((d) => d.id === lookup || d.slug === lookup);
      if (!dish) {
        throw new AppError(
          `Dish with ID '${lookup}' not found in active menu.`,
          400
        );
      }
      if (!dish.available) {
        throw new AppError(
          `'${dish.name}' is currently sold out and unavailable. Please update your tray.`,
          400
        );
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

    if (fulfillmentType === 'delivery' && calculatedSubtotal < settings.minOrderValue) {
      throw new AppError(
        `Minimum order value for home delivery is ₹${settings.minOrderValue}. Your current subtotal is ₹${calculatedSubtotal}.`,
        400
      );
    }

    const taxRate = settings.taxRatePercent / 100;
    const taxAmount = Math.round(calculatedSubtotal * taxRate);
    const deliveryCharge = fulfillmentType === 'delivery' ? settings.deliveryFee : 0;
    const discountAmount = 0;
    const grandTotal = calculatedSubtotal + taxAmount + deliveryCharge - discountAmount;

    const { orderNumber, invoiceNumber } = await generateOrderNumber();
    const now = new Date().toISOString();
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const initialPaymentStatus = paymentMethod === 'online' ? 'paid' : 'pending';

    const newOrder: IOrder = {
      id: orderId,
      orderNumber,
      customerName: String(customerName).trim(),
      customerPhone: String(customerPhone).trim(),
      customerEmail: customerEmail ? String(customerEmail).trim() : undefined,
      deliveryAddress: deliveryAddress
        ? String(deliveryAddress).trim()
        : fulfillmentType === 'dine-in'
          ? 'Dine-In Table'
          : 'Pickup Counter',
      fulfillmentType: ['dine-in', 'pickup', 'delivery'].includes(fulfillmentType)
        ? fulfillmentType
        : 'delivery',
      items: verifiedItems,
      subtotal: calculatedSubtotal,
      taxAmount,
      deliveryCharge,
      discountAmount,
      grandTotal,
      paymentMethod: ['online', 'cod', 'upi'].includes(paymentMethod)
        ? paymentMethod
        : 'cod',
      paymentStatus: initialPaymentStatus,
      orderStatus: 'pending',
      notes: notes ? String(notes).trim() : undefined,
      statusHistory: [
        {
          status: 'pending',
          timestamp: now,
          actor: 'Customer Order Portal',
          note: `Order placed via ${String(fulfillmentType).toUpperCase()} with ${String(paymentMethod).toUpperCase()}`,
        },
      ],
      invoiceNumber,
      createdAt: now,
      updatedAt: now,
    };

    const newInvoice: IInvoice = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
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

    const newPayment: IPayment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      paymentReference: `PAY_${orderNumber}`,
      orderId,
      orderNumber,
      amount: grandTotal,
      paymentMethod: newOrder.paymentMethod,
      paymentStatus: initialPaymentStatus,
      transactionDate: now,
      gatewayTransactionReference:
        paymentMethod === 'online' ? `razor_${Date.now()}` : undefined,
    };

    const normalizedPhone = String(customerPhone).replace(/\D/g, '') || String(customerPhone).trim();

    await Promise.all([
      OrderModel.create(newOrder),
      InvoiceModel.create(newInvoice),
      PaymentModel.create(newPayment),
      CustomerModel.findOneAndUpdate(
        { normalizedPhone },
        {
          $inc: { totalOrders: 1, totalSpent: grandTotal },
          $set: {
            lastOrderDate: now,
            ...(customerEmail ? { email: String(customerEmail).trim() } : {}),
          },
          $setOnInsert: {
            id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            name: String(customerName).trim(),
            phone: String(customerPhone).trim(),
            normalizedPhone,
            createdAt: now,
          },
        },
        { upsert: true }
      ),
    ]);

    await logAudit(
      'ORDER_PLACED',
      'Customer',
      `Order ${orderNumber} placed for ₹${grandTotal} by ${customerName}`
    );

    return { order: newOrder, invoice: newInvoice };
  },

  async getAdminOrders(query: any) {
    await connectDB();
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

    const filter: Record<string, any> = {};
    if (search) {
      const rx = new RegExp(escapeRegex(String(search)), 'i');
      filter.$or = [
        { orderNumber: rx },
        { customerName: rx },
        { customerPhone: rx },
        { invoiceNumber: rx },
      ];
    }
    if (orderStatus && orderStatus !== 'all') filter.orderStatus = orderStatus;
    if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
    if (fulfillmentType && fulfillmentType !== 'all') {
      filter.fulfillmentType = fulfillmentType;
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = String(startDate);
      if (endDate) filter.createdAt.$lte = `${String(endDate)}T23:59:59.999Z`;
    }

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [total, rawOrders] = await Promise.all([
      OrderModel.countDocuments(filter),
      OrderModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return {
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      orders: cleanDocs<IOrder>(rawOrders),
    };
  },

  async getOrderDetails(id: string) {
    await connectDB();
    const orderDoc = await OrderModel.findOne({
      $or: [{ id }, { orderNumber: id }],
    }).lean();

    if (!orderDoc) {
      throw new AppError('Order not found.', 404);
    }

    const order = cleanDoc<IOrder>(orderDoc);
    const [paymentDoc, invoiceDoc] = await Promise.all([
      PaymentModel.findOne({ orderId: order.id }).lean(),
      InvoiceModel.findOne({ orderId: order.id }).lean(),
    ]);

    return {
      order,
      payment: paymentDoc ? cleanDoc<IPayment>(paymentDoc) : undefined,
      invoice: invoiceDoc ? cleanDoc<IInvoice>(invoiceDoc) : undefined,
    };
  },

  async updateOrderStatus(
    orderId: string,
    status: string,
    note?: string,
    actor = 'Staff'
  ) {
    if (!status || !VALID_STATUSES.includes(status as any)) {
      throw new AppError(
        `Invalid order status. Allowed: ${VALID_STATUSES.join(', ')}`,
        400
      );
    }

    await connectDB();
    const now = new Date().toISOString();
    const updated = await OrderModel.findOneAndUpdate(
      { id: orderId },
      {
        $set: { orderStatus: status, updatedAt: now },
        $push: {
          statusHistory: {
            status,
            timestamp: now,
            actor,
            note: note ? String(note).trim() : `Status changed to ${status.toUpperCase()}`,
          },
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      throw new AppError('Order not found.', 404);
    }

    const clean = cleanDoc<IOrder>(updated);
    await logAudit(
      'ORDER_STATUS_CHANGED',
      actor,
      `Order ${clean.orderNumber} status changed to ${status}`
    );
    return clean;
  },

  async updateOrderPayment(
    orderId: string,
    paymentStatus: string,
    collectedBy?: string,
    actor = 'Staff'
  ) {
    if (!paymentStatus || !VALID_PAYMENTS.includes(paymentStatus as any)) {
      throw new AppError(
        `Invalid payment status. Allowed: ${VALID_PAYMENTS.join(', ')}`,
        400
      );
    }

    await connectDB();
    const updated = await OrderModel.findOneAndUpdate(
      { id: orderId },
      { $set: { paymentStatus, updatedAt: new Date().toISOString() } },
      { new: true }
    ).lean();

    if (!updated) {
      throw new AppError('Order not found.', 404);
    }

    const clean = cleanDoc<IOrder>(updated);

    await Promise.all([
      PaymentModel.updateOne(
        { orderId: clean.id },
        {
          $set: {
            paymentStatus,
            ...(collectedBy ? { collectedBy } : {}),
          },
        }
      ),
      InvoiceModel.updateOne({ orderId: clean.id }, { $set: { paymentStatus } }),
    ]);

    await logAudit(
      'PAYMENT_STATUS_CHANGED',
      actor,
      `Order ${clean.orderNumber} payment marked as ${paymentStatus}`
    );
    return clean;
  },
};
