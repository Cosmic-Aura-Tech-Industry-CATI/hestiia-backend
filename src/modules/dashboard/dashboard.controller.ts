import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { dashboardService } from './dashboard.service.js';

export const getOverview = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const data = await dashboardService.getOverview();
  res.status(200).json({
    success: true,
    ...data,
  });
});
