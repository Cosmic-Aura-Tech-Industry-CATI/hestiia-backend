import { db } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';

export const paymentsService = {
  async getPayments(query: any) {
    const { search, paymentStatus, paymentMethod, page = '1', limit = '20' } = query;
    let payments = [...db.getState().payments];

    if (search) {
      const q = String(search).toLowerCase();
      payments = payments.filter(
        (p) =>
          p.paymentReference.toLowerCase().includes(q) ||
          p.orderNumber.toLowerCase().includes(q) ||
          (p.gatewayTransactionReference && p.gatewayTransactionReference.toLowerCase().includes(q))
      );
    }

    if (paymentStatus && paymentStatus !== 'all') {
      payments = payments.filter((p) => p.paymentStatus === paymentStatus);
    }

    if (paymentMethod && paymentMethod !== 'all') {
      payments = payments.filter((p) => p.paymentMethod === paymentMethod);
    }

    payments.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = payments.slice(startIndex, startIndex + limitNum);

    return {
      total: payments.length,
      page: pageNum,
      totalPages: Math.ceil(payments.length / limitNum),
      payments: paginated,
    };
  },

  async recordCollection(payload: { paymentId?: string; orderNumber?: string; collectedBy?: string }, actor = 'Staff') {
    const { paymentId, orderNumber, collectedBy } = payload;
    let updated = false;

    db.updateState((s) => {
      const payment = s.payments.find((p) => (paymentId && p.id === paymentId) || (orderNumber && p.orderNumber === orderNumber));
      if (payment) {
        payment.paymentStatus = 'paid';
        payment.collectedBy = collectedBy || actor;
        updated = true;

        const order = s.orders.find((o) => o.id === payment.orderId || o.orderNumber === payment.orderNumber);
        if (order) {
          order.paymentStatus = 'paid';
          order.updatedAt = new Date().toISOString();
          order.statusHistory.push({
            status: order.orderStatus,
            timestamp: new Date().toISOString(),
            actor,
            note: `Payment collected in full (₹${payment.amount}) by ${collectedBy || actor}`,
          });
        }

        const invoice = s.invoices.find((i) => i.orderId === payment.orderId || i.orderNumber === payment.orderNumber);
        if (invoice) {
          invoice.paymentStatus = 'paid';
        }
      }
    });

    if (!updated) {
      throw new AppError('Payment record not found.', 404);
    }

    db.logAudit('PAYMENT_COLLECTED', actor, `Payment for order ${orderNumber} marked as collected`);
  },
};
