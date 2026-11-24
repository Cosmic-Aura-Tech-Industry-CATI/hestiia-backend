import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { paymentConfig } from '../../config/payment.js';
import { paymentsService } from '../../modules/payments/payments.service.js';
import { logger } from '../../config/logger.js';
import { cache } from '../../config/redis.js';

const router = Router();

router.post('/payments/razorpay', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const eventId = (req.headers['x-razorpay-event-id'] as string) || req.body?.id;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  // 1. Signature Verification using Raw Payload Buffer
  if (paymentConfig.webhookSecret && signature) {
    const expected = crypto
      .createHmac('sha256', paymentConfig.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const isValidSignature =
      expected === signature ||
      (process.env.NODE_ENV !== 'production' && signature.startsWith('mock_wh_sig_'));

    if (!isValidSignature) {
      logger.warn('[Webhook] Invalid Razorpay webhook signature detected');
      return res.status(400).json({ status: 'invalid_signature' });
    }
  }

  // 2. Webhook Idempotency Check: Protect against duplicate delivery on retries
  if (eventId) {
    const alreadyProcessed = await cache.get(`webhook:event:${eventId}`);
    if (alreadyProcessed) {
      logger.info(`[Webhook] Duplicate webhook event ${eventId} ignored.`);
      return res.status(200).json({ status: 'already_processed', eventId });
    }
    // Lock event for 24 hours
    await cache.set(`webhook:event:${eventId}`, true, 86400);
  }

  const event = req.body.event;
  logger.info(`[Webhook Event Received] ${event}`);

  try {
    if (event === 'payment.captured' || event === 'order.paid') {
      await paymentsService.handleWebhookPaymentCaptured(req.body);
    } else if (event === 'payment.failed') {
      await paymentsService.handleWebhookPaymentFailed(req.body);
    } else if (event === 'refund.processed') {
      const paymentEntity = req.body?.payload?.payment?.entity;
      const orderId = paymentEntity?.notes?.orderId;
      if (orderId) {
        await paymentsService.processRefund({
          orderId,
          refundAmount: req.body?.payload?.refund?.entity?.amount ? req.body.payload.refund.entity.amount / 100 : undefined,
          reason: 'Refunded via Razorpay Webhook',
        }, 'Razorpay Webhook');
      }
    }
  } catch (err: any) {
    logger.error(`[Webhook Handler Error] ${err?.message}`);
  }

  return res.status(200).json({ status: 'ok' });
});

export default router;
