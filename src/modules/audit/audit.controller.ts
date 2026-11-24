import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { auditService } from './audit.service.js';

export const getAuditLogs = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await auditService.getAuditLogs(req.query);
  res.status(200).json({ success: true, ...result });
});

export const getAuditStats = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const stats = await auditService.getAuditStats();
  res.status(200).json({ success: true, stats });
});

export const clearOldLogs = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const days = req.body?.daysToKeep || req.query?.daysToKeep || 90;
  const result = await auditService.clearOldLogs(Number(days));
  res.status(200).json({
    message: `Audit logs older than ${days} days purged successfully.`,
    ...result,
  });
});
