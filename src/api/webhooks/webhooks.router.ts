import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { paymentConfig } from '../../config/payment.js';
import { ordersService } from '../../modules/orders/orders.service.js';
import { logger } from '../../config/logger.js';

const router = Router();

router.post('/payments/razorpay', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const body = JSON.stringify(req.body);

  if (paymentConfig.webhookSecret && signature) {
    const expected = crypto
      .createHmac('sha256', paymentConfig.webhookSecret)
      .update(body)
      .digest('hex');

    if (expected !== signature) {
      logger.warn('[Webhook] Invalid Razorpay signature detected');
      return res.status(400).json({ status: 'invalid_signature' });
    }
  }

  const event = req.body.event;
  logger.info(`[Webhook Event Received] ${event}`);

  if (event === 'payment.captured' && req.body.payload?.payment?.entity?.notes?.orderId) {
    const orderId = req.body.payload.payment.entity.notes.orderId;
    await ordersService.updateOrderPayment(orderId, 'paid', 'Razorpay Webhook');
  }

  res.status(200).json({ status: 'ok' });
});

export default router;
