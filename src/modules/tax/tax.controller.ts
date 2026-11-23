import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { sendSuccess } from '../../shared/responses/index.js';
import { taxService } from './tax.service.js';
import type { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';

export const getConfig = catchAsync(async (_req: Request, res: Response) => {
  const config = await taxService.getConfig();
  sendSuccess(res, { config });
});

export const updateConfig = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user?.name || req.user?.username || 'Superadmin';
  const updated = await taxService.updateConfig(req.body, actor);
  sendSuccess(res, { config: updated }, 200, 'Tax configuration updated successfully');
});

export const calculateTax = catchAsync(async (req: Request, res: Response) => {
  const result = await taxService.calculateTax(req.body);
  sendSuccess(res, result);
});

export const getEstimate = catchAsync(async (req: Request, res: Response) => {
  const amount = Number(req.query.amount) || 0;
  const estimate = await taxService.getEstimate(amount);
  sendSuccess(res, estimate);
});

export const getGstr3bSummary = catchAsync(async (req: Request, res: Response) => {
  const period = (req.query.period as string) || 'current_month';
  const summary = await taxService.getGstr3bSummary(period);
  sendSuccess(res, summary);
});

export const getStatus = catchAsync(async (_req: Request, res: Response) => {
  const status = await taxService.getStatus();
  sendSuccess(res, status);
});
