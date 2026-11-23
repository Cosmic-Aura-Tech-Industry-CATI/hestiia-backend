import crypto from 'crypto';
import { db, Payment, Order, Invoice } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';
import { paymentConfig } from '../../config/payment.js';
import { eventBus, DOMAIN_EVENTS } from '../../events/eventBus.js';
import { logger } from '../../config/logger.js';
import { cache } from '../../config/redis.js';

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
          (p.gatewayTransactionReference && p.gatewayTransactionReference.toLowerCase().includes(q)) ||
          (p.upiUtr && p.upiUtr.toLowerCase().includes(q))
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

  async createPaymentIntent(payload: { orderId: string; idempotencyKey?: string }) {
    const { orderId, idempotencyKey } = payload;
    const state = db.getState();

    const order = state.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!order) {
      throw new AppError('Order not found for payment initialization.', 404);
    }

    if (order.paymentStatus === 'paid') {
      throw new AppError('This order has already been paid in full.', 400);
    }

    if (order.orderStatus === 'cancelled') {
      throw new AppError('Cannot initiate payment for a cancelled order.', 400);
    }

    // Idempotency check via cache if key provided
    if (idempotencyKey) {
      const cachedIntent = await cache.get(`intent:${idempotencyKey}`);
      if (cachedIntent) {
        return cachedIntent;
      }
    }

    const amountInPaise = order.grandTotalInPaise || Math.round(order.grandTotal * 100);
    const gatewayOrderId = `order_hst_${order.orderNumber.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;

    let updatedPayment: Payment | null = null;
    db.updateState((s) => {
      let payment = s.payments.find((p) => p.orderId === order.id);
      if (payment) {
        payment.gatewayOrderId = gatewayOrderId;
        payment.amountInPaise = amountInPaise;
        if (idempotencyKey) payment.idempotencyKey = idempotencyKey;
        updatedPayment = { ...payment };
      } else {
        payment = {
          id: 'pay_' + Date.now(),
          paymentReference: `PAY_${order.orderNumber}`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: order.grandTotal,
          amountInPaise,
          paymentMethod: order.paymentMethod,
          paymentStatus: 'pending',
          transactionDate: new Date().toISOString(),
          gatewayOrderId,
          idempotencyKey,
        };
        s.payments.unshift(payment);
        updatedPayment = { ...payment };
      }
    });

    const intentResult = {
      keyId: paymentConfig.keyId,
      gatewayOrderId,
      amount: order.grandTotal,
      amountInPaise,
      currency: 'INR',
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
    };

    if (idempotencyKey) {
      await cache.set(`intent:${idempotencyKey}`, intentResult, 900); // 15 min lock
    }

    eventBus.emitEvent(DOMAIN_EVENTS.PAYMENT_INTENT_CREATED, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.grandTotal,
      gatewayOrderId,
    });

    return intentResult;
  },

  async verifyOnlinePayment(payload: {
    orderId: string;
    paymentId?: string;
    gatewayOrderId: string;
    gatewayPaymentId: string;
    gatewaySignature: string;
  }) {
    const { orderId, gatewayOrderId, gatewayPaymentId, gatewaySignature } = payload;

    if (!gatewayOrderId || !gatewayPaymentId || !gatewaySignature) {
      throw new AppError('gatewayOrderId, gatewayPaymentId, and gatewaySignature are mandatory for verification.', 400);
    }

    // 1. Cryptographic HMAC-SHA256 signature verification (Never trust frontend)
    const body = `${gatewayOrderId}|${gatewayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', paymentConfig.keySecret)
      .update(body)
      .digest('hex');

    const isValidSignature =
      expectedSignature === gatewaySignature ||
      // In development/test mock mode, accept mock signatures starting with 'valid_mock_'
      (process.env.NODE_ENV !== 'production' && gatewaySignature.startsWith('valid_mock_'));

    if (!isValidSignature) {
      logger.warn(`[Payment] Cryptographic signature mismatch for order ${orderId}`);
      throw new AppError('Payment signature verification failed. Untrusted payment transaction rejected.', 400);
    }

    const now = new Date().toISOString();
    let verifiedPayment: Payment | null = null;

    db.updateState((s) => {
      const payment = s.payments.find(
        (p) =>
          p.orderId === orderId ||
          p.orderNumber === orderId ||
          (p.gatewayOrderId && p.gatewayOrderId === gatewayOrderId)
      );

      if (payment) {
        payment.paymentStatus = 'paid';
        payment.gatewayTransactionReference = gatewayPaymentId;
        payment.gatewaySignature = gatewaySignature;
        payment.transactionDate = now;
        verifiedPayment = { ...payment };
      }
    });

    if (!verifiedPayment) {
      throw new AppError('Payment record not found for verification.', 404);
    }

    db.logAudit(
      'PAYMENT_VERIFIED_ONLINE',
      'Payment Gateway',
      `Payment ${(verifiedPayment as Payment).paymentReference} verified online. Gateway Txn: ${gatewayPaymentId}`
    );

    // 2. Publish Domain Event to orchestrate decoupled updates
    eventBus.emitEvent(DOMAIN_EVENTS.PAYMENT_PAID, {
      payment: verifiedPayment,
      actor: 'Razorpay Gateway Verification',
      gatewayTxn: gatewayPaymentId,
    });

    return verifiedPayment;
  },

  async submitManualUpiReference(payload: {
    orderId: string;
    orderNumber?: string;
    upiUtr: string;
  }) {
    const { orderId, orderNumber, upiUtr } = payload;
    const cleanUtr = String(upiUtr || '').trim();

    if (!cleanUtr || cleanUtr.length < 8 || cleanUtr.length > 25) {
      throw new AppError('A valid 8-22 digit UPI Transaction Reference / UTR number is required.', 400);
    }

    const state = db.getState();

    // Prevent duplicate UTR fraud
    const duplicateUtr = state.payments.find(
      (p) => p.upiUtr === cleanUtr && p.paymentStatus === 'paid'
    );
    if (duplicateUtr) {
      throw new AppError('This UPI UTR reference has already been claimed by another transaction.', 400);
    }

    const now = new Date().toISOString();
    let updatedPayment: Payment | null = null;

    db.updateState((s) => {
      const payment = s.payments.find(
        (p) => (orderId && p.orderId === orderId) || (orderNumber && p.orderNumber === orderNumber)
      );

      if (payment) {
        payment.paymentMethod = 'upi';
        payment.paymentStatus = 'awaiting_verification';
        payment.upiUtr = cleanUtr;
        payment.upiSubmittedAt = now;
        updatedPayment = { ...payment };

        const order = s.orders.find((o) => o.id === payment.orderId || o.orderNumber === payment.orderNumber);
        if (order) {
          order.paymentStatus = 'awaiting_verification';
          order.statusHistory.push({
            status: order.orderStatus,
            timestamp: now,
            actor: 'Customer',
            note: `Submitted manual UPI UTR: ${cleanUtr}. Awaiting cashier/manager credit verification.`,
          });
        }
      }
    });

    if (!updatedPayment) {
      throw new AppError('Payment record not found for UPI submission.', 404);
    }

    db.logAudit(
      'UPI_UTR_SUBMITTED',
      'Customer',
      `Order ${(updatedPayment as Payment).orderNumber} submitted UPI UTR ${cleanUtr}`
    );

    eventBus.emitEvent(DOMAIN_EVENTS.PAYMENT_UPI_SUBMITTED, {
      payment: updatedPayment,
      upiUtr: cleanUtr,
    });

    return updatedPayment;
  },

  async verifyManualUpi(
    payload: { paymentId?: string; orderNumber?: string; approved: boolean; reason?: string },
    actor = 'Staff'
  ) {
    const { paymentId, orderNumber, approved, reason } = payload;
    const now = new Date().toISOString();
    let resultPayment: Payment | null = null;

    db.updateState((s) => {
      const payment = s.payments.find(
        (p) => (paymentId && p.id === paymentId) || (orderNumber && p.orderNumber === orderNumber)
      );

      if (payment) {
        if (approved) {
          payment.paymentStatus = 'paid';
          payment.upiVerifiedAt = now;
          payment.upiVerifiedBy = actor;
          resultPayment = { ...payment };
        } else {
          payment.paymentStatus = 'failed';
          payment.upiVerifiedAt = now;
          payment.upiVerifiedBy = actor;
          resultPayment = { ...payment };

          const order = s.orders.find((o) => o.id === payment.orderId);
          if (order) {
            order.paymentStatus = 'failed';
            order.statusHistory.push({
              status: order.orderStatus,
              timestamp: now,
              actor,
              note: `UPI verification rejected: ${reason || 'UTR not reflected in bank account'}.`,
            });
          }
        }
      }
    });

    if (!resultPayment) {
      throw new AppError('Payment record not found.', 404);
    }

    if (approved) {
      db.logAudit('UPI_VERIFIED_SUCCESS', actor, `UPI payment verified for order ${(resultPayment as Payment).orderNumber}`);
      eventBus.emitEvent(DOMAIN_EVENTS.PAYMENT_PAID, {
        payment: resultPayment,
        actor: `Staff Verification (${actor})`,
      });
    } else {
      db.logAudit('UPI_VERIFIED_REJECTED', actor, `UPI payment rejected for order ${(resultPayment as Payment).orderNumber}`);
      eventBus.emitEvent(DOMAIN_EVENTS.PAYMENT_FAILED, {
        payment: resultPayment,
        actor: `Staff Verification (${actor})`,
        reason,
      });
    }

    return resultPayment;
  },

  async processRefund(
    payload: { paymentId?: string; orderId?: string; refundAmount?: number; reason?: string },
    actor = 'Staff'
  ) {
    const { paymentId, orderId, refundAmount, reason } = payload;
    const now = new Date().toISOString();
    let refundedPayment: Payment | null = null;

    db.updateState((s) => {
      const payment = s.payments.find(
        (p) => (paymentId && p.id === paymentId) || (orderId && p.orderId === orderId)
      );

      if (payment) {
        if (payment.paymentStatus !== 'paid') {
          return; // Only paid payments are refundable
        }
        payment.paymentStatus = 'refunded';
        payment.refundReference = `RFD_${Date.now()}`;
        payment.refundAmount = refundAmount || payment.amount;
        payment.refundReason = reason || 'Order cancelled';
        payment.refundedAt = now;
        refundedPayment = { ...payment };

        const invoice = s.invoices.find((i) => i.orderId === payment.orderId);
        if (invoice) {
          invoice.paymentStatus = 'refunded';
        }
      }
    });

    if (!refundedPayment) {
      return null;
    }

    db.logAudit(
      'PAYMENT_REFUNDED',
      actor,
      `Refund of ₹${(refundedPayment as Payment).refundAmount} processed for order ${(refundedPayment as Payment).orderNumber}`
    );

    eventBus.emitEvent(DOMAIN_EVENTS.PAYMENT_REFUNDED, {
      payment: refundedPayment,
      actor,
      reason,
    });

    return refundedPayment;
  },

  async recordCollection(payload: { paymentId?: string; orderNumber?: string; collectedBy?: string }, actor = 'Staff') {
    const { paymentId, orderNumber, collectedBy } = payload;
    let updatedPayment: Payment | null = null;
    const now = new Date().toISOString();

    db.updateState((s) => {
      const payment = s.payments.find((p) => (paymentId && p.id === paymentId) || (orderNumber && p.orderNumber === orderNumber));
      if (payment) {
        payment.paymentStatus = 'paid';
        payment.collectedBy = collectedBy || actor;
        payment.transactionDate = now;
        updatedPayment = { ...payment };
      }
    });

    if (!updatedPayment) {
      throw new AppError('Payment record not found.', 404);
    }

    db.logAudit('PAYMENT_COLLECTED', actor, `Payment for order ${orderNumber} marked as collected`);

    eventBus.emitEvent(DOMAIN_EVENTS.PAYMENT_PAID, {
      payment: updatedPayment,
      actor: collectedBy || actor,
    });

    return updatedPayment;
  },

  async handleWebhookPaymentCaptured(eventPayload: any) {
    const paymentEntity = eventPayload?.payload?.payment?.entity;
    const orderId = paymentEntity?.notes?.orderId || paymentEntity?.notes?.order_id;
    const gatewayPaymentId = paymentEntity?.id;
    const amountInPaise = paymentEntity?.amount;

    if (!orderId && !gatewayPaymentId) {
      logger.warn('[Webhook] Captured event missing orderId or gatewayPaymentId');
      return;
    }

    const state = db.getState();
    const existingPayment = state.payments.find(
      (p) => p.orderId === orderId || p.orderNumber === orderId || (gatewayPaymentId && p.gatewayTransactionReference === gatewayPaymentId)
    );

    if (existingPayment && existingPayment.paymentStatus === 'paid') {
      logger.info(`[Webhook] Payment for order ${orderId} already marked as paid. Idempotent skip.`);
      return existingPayment;
    }

    let updatedPayment: Payment | null = null;
    const now = new Date().toISOString();

    db.updateState((s) => {
      const target = s.payments.find(
        (p) => p.orderId === orderId || p.orderNumber === orderId || p.gatewayOrderId === paymentEntity?.order_id
      );
      if (target) {
        target.paymentStatus = 'paid';
        target.gatewayTransactionReference = gatewayPaymentId;
        target.transactionDate = now;
        if (amountInPaise) target.amountInPaise = amountInPaise;
        updatedPayment = { ...target };
      }
    });

    if (updatedPayment) {
      db.logAudit('WEBHOOK_PAYMENT_CAPTURED', 'Razorpay Webhook', `Captured ₹${(updatedPayment as Payment).amount} for ${(updatedPayment as Payment).orderNumber}`);
      eventBus.emitEvent(DOMAIN_EVENTS.PAYMENT_PAID, {
        payment: updatedPayment,
        actor: 'Razorpay Webhook',
        gatewayTxn: gatewayPaymentId,
      });
    }

    return updatedPayment;
  },

  async handleWebhookPaymentFailed(eventPayload: any) {
    const paymentEntity = eventPayload?.payload?.payment?.entity;
    const orderId = paymentEntity?.notes?.orderId || paymentEntity?.notes?.order_id;
    const errorDescription = paymentEntity?.error_description || 'Payment rejected by bank';

    db.updateState((s) => {
      const target = s.payments.find((p) => p.orderId === orderId || p.orderNumber === orderId);
      if (target) {
        target.paymentStatus = 'failed';
      }
    });

    eventBus.emitEvent(DOMAIN_EVENTS.PAYMENT_FAILED, {
      orderId,
      error: errorDescription,
      actor: 'Razorpay Webhook',
    });
  },

  async getReconciliationReport() {
    const state = db.getState();
    const orders = state.orders;
    const payments = state.payments;

    const totalOrders = orders.length;
    const totalOrderValue = orders.reduce((sum, o) => sum + o.grandTotal, 0);

    const paidPayments = payments.filter((p) => p.paymentStatus === 'paid');
    const totalPaidAmount = paidPayments.reduce((sum, p) => sum + p.amount, 0);

    const onlineCaptured = paidPayments.filter((p) => p.paymentMethod === 'online');
    const codCollected = paidPayments.filter((p) => p.paymentMethod === 'cod');
    const upiVerified = paidPayments.filter((p) => p.paymentMethod === 'upi');

    const pendingUpi = payments.filter((p) => p.paymentStatus === 'awaiting_verification');
    const refundedPayments = payments.filter((p) => p.paymentStatus === 'refunded');
    const totalRefundedAmount = refundedPayments.reduce((sum, p) => sum + (p.refundAmount || p.amount), 0);

    // Identify discrepancies
    const discrepancies: any[] = [];
    for (const order of orders) {
      const payment = payments.find((p) => p.orderId === order.id);
      if (!payment) {
        discrepancies.push({
          orderNumber: order.orderNumber,
          issue: 'Missing payment record',
          orderAmount: order.grandTotal,
        });
      } else if (order.paymentStatus === 'paid' && payment.paymentStatus !== 'paid') {
        discrepancies.push({
          orderNumber: order.orderNumber,
          issue: `Status mismatch: Order is '${order.paymentStatus}' but Payment is '${payment.paymentStatus}'`,
          orderAmount: order.grandTotal,
          paymentAmount: payment.amount,
        });
      } else if (Math.abs(order.grandTotal - payment.amount) > 0.01) {
        discrepancies.push({
          orderNumber: order.orderNumber,
          issue: `Amount discrepancy: Order ₹${order.grandTotal} != Payment ₹${payment.amount}`,
          orderAmount: order.grandTotal,
          paymentAmount: payment.amount,
        });
      }
    }

    return {
      totalOrders,
      totalOrderValue,
      totalPaidAmount,
      onlineCapturedCount: onlineCaptured.length,
      onlineCapturedAmount: onlineCaptured.reduce((sum, p) => sum + p.amount, 0),
      codCollectedCount: codCollected.length,
      codCollectedAmount: codCollected.reduce((sum, p) => sum + p.amount, 0),
      upiVerifiedCount: upiVerified.length,
      upiVerifiedAmount: upiVerified.reduce((sum, p) => sum + p.amount, 0),
      pendingUpiVerificationCount: pendingUpi.length,
      refundedCount: refundedPayments.length,
      totalRefundedAmount,
      discrepancyCount: discrepancies.length,
      discrepancies,
      generatedAt: new Date().toISOString(),
    };
  },
};
