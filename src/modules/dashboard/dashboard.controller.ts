import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { sendSuccess } from '../../shared/responses/index.js';
import { dashboardService } from './dashboard.service.js';

export const getOverview = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const data = await dashboardService.getOverview();
  sendSuccess(res, data);
});

export const getSalesTrend = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const days = req.query.days ? Number(req.query.days) : 7;
  const trend = await dashboardService.getSalesTrend(days);
  sendSuccess(res, { days, count: trend.length, trend });
});

export const getPopularItems = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const popularItems = await dashboardService.getPopularItems(limit);
  sendSuccess(res, { limit, count: popularItems.length, popularItems });
});

export const getLiveOrders = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const liveOrders = await dashboardService.getLiveOrders();
  sendSuccess(res, { count: liveOrders.length, liveOrders });
});
