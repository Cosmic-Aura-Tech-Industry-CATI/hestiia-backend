import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { paymentsService } from './payments.service.js';

export const getPayments = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await paymentsService.getPayments(req.query);
  res.status(200).json({ success: true, ...result });
});

export const recordCollection = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user?.name || req.user?.username || 'Staff';
  const payment = await paymentsService.recordCollection(req.body, actor);
  res.status(200).json({
    success: true,
    payment,
    message: `Payment for order ${req.body.orderNumber || ''} recorded as paid.`,
  });
});

export const createPaymentIntent = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentsService.createPaymentIntent(req.body);
  res.status(200).json({
    success: true,
    message: 'Payment intent created successfully.',
    ...result,
  });
});

export const verifyOnlinePayment = catchAsync(async (req: Request, res: Response) => {
  const payment = await paymentsService.verifyOnlinePayment(req.body);
  res.status(200).json({
    success: true,
    message: 'Payment verified successfully and confirmed by server.',
    payment,
  });
});

export const submitManualUpi = catchAsync(async (req: Request, res: Response) => {
  const payment = await paymentsService.submitManualUpiReference(req.body);
  res.status(200).json({
    success: true,
    message: 'UPI transaction reference submitted. Staff will verify and confirm.',
    payment,
  });
});

export const verifyManualUpi = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user?.name || req.user?.username || 'Staff';
  const payment = await paymentsService.verifyManualUpi(req.body, actor);
  res.status(200).json({
    success: true,
    message: req.body.approved
      ? 'UPI payment approved and order confirmed.'
      : 'UPI payment rejected.',
    payment,
  });
});

export const refundPayment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user?.name || req.user?.username || 'Staff';
  const paymentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const payment = await paymentsService.processRefund(
    { paymentId, reason: req.body.reason, refundAmount: req.body.amount },
    actor
  );
  res.status(200).json({
    success: true,
    message: 'Payment refund processed successfully.',
    payment,
  });
});

export const getReconciliationReport = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const report = await paymentsService.getReconciliationReport();
  res.status(200).json({
    success: true,
    report,
  });
});
