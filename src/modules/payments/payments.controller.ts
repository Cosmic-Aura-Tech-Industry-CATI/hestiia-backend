import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { paymentsService } from './payments.service.js';

export const getPayments = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await paymentsService.getPayments(req.query);
  res.status(200).json({ success: true, ...result });
});

export const recordCollection = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user?.name || req.user?.username || 'Staff';
  await paymentsService.recordCollection(req.body, actor);
  res.status(200).json({
    success: true,
    message: `Payment for order ${req.body.orderNumber || ''} recorded as paid.`,
  });
});
