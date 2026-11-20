import { AppError } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';
import { logAudit } from '@/lib/audit';
import { escapeRegex } from '@/lib/regex';
import { InvoiceModel } from '@/models/Invoice.model';
import { OrderModel } from '@/models/Order.model';
import { IPayment, PaymentModel } from '@/models/Payment.model';
import { cleanDocs } from '@/models/_schema';

export const paymentsService = {
  async getPayments(query: any) {
    await connectDB();
    const { search, paymentStatus, paymentMethod, page = '1', limit = '20' } = query;

    const filter: Record<string, any> = {};
    if (search) {
      const rx = new RegExp(escapeRegex(String(search)), 'i');
      filter.$or = [
        { paymentReference: rx },
        { orderNumber: rx },
        { gatewayTransactionReference: rx },
      ];
    }
    if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
    if (paymentMethod && paymentMethod !== 'all') filter.paymentMethod = paymentMethod;

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [total, rawPayments] = await Promise.all([
      PaymentModel.countDocuments(filter),
      PaymentModel.find(filter)
        .sort({ transactionDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return {
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      payments: cleanDocs<IPayment>(rawPayments),
    };
  },

  async recordCollection(
    payload: { paymentId?: string; orderNumber?: string; collectedBy?: string },
    actor = 'Staff'
  ) {
    const { paymentId, orderNumber, collectedBy } = payload;
    await connectDB();

    const orConditions: Array<Record<string, string>> = [];
    if (paymentId) orConditions.push({ id: paymentId });
    if (orderNumber) orConditions.push({ orderNumber });
    if (orConditions.length === 0) {
      throw new AppError('Payment ID or order number is required.', 400);
    }

    const payment = await PaymentModel.findOneAndUpdate(
      { $or: orConditions },
      { $set: { paymentStatus: 'paid', collectedBy: collectedBy || actor } },
      { new: true }
    ).lean();

    if (!payment) {
      throw new AppError('Payment record not found.', 404);
    }

    const now = new Date().toISOString();
    const order = await OrderModel.findOne({
      $or: [{ id: payment.orderId }, { orderNumber: payment.orderNumber }],
    }).lean();

    await Promise.all([
      order
        ? OrderModel.updateOne(
            { id: order.id },
            {
              $set: { paymentStatus: 'paid', updatedAt: now },
              $push: {
                statusHistory: {
                  status: order.orderStatus,
                  timestamp: now,
                  actor,
                  note: `Payment collected in full (₹${payment.amount}) by ${collectedBy || actor}`,
                },
              },
            }
          )
        : Promise.resolve(),
      InvoiceModel.updateOne(
        { $or: [{ orderId: payment.orderId }, { orderNumber: payment.orderNumber }] },
        { $set: { paymentStatus: 'paid' } }
      ),
    ]);

    await logAudit(
      'PAYMENT_COLLECTED',
      actor,
      `Payment for order ${payment.orderNumber} marked as collected`
    );
  },
};
