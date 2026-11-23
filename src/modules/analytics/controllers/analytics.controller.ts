import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/utils/catchAsync.js';
import { sendSuccess } from '../../../shared/responses/index.js';
import { analyticsOverviewService } from '../services/analytics-overview.service.js';
import { analyticsRevenueService } from '../services/analytics-revenue.service.js';
import { analyticsOrdersService } from '../services/analytics-orders.service.js';
import { analyticsProductsService } from '../services/analytics-products.service.js';
import { analyticsCustomersService } from '../services/analytics-customers.service.js';
import { analyticsPaymentsService } from '../services/analytics-payments.service.js';

export const getOverview = catchAsync(async (req: Request, res: Response) => {
  const result = await analyticsOverviewService.getOverviewMetrics(req.query as any);
  return sendSuccess(res, result);
});

export const getRevenue = catchAsync(async (req: Request, res: Response) => {
  const result = await analyticsRevenueService.getRevenueAnalytics(req.query as any);
  return sendSuccess(res, result);
});

export const getOrders = catchAsync(async (req: Request, res: Response) => {
  const result = await analyticsOrdersService.getOrderAnalytics(req.query as any);
  return sendSuccess(res, result);
});

export const getProducts = catchAsync(async (req: Request, res: Response) => {
  const result = await analyticsProductsService.getProductPerformance(req.query as any);
  return sendSuccess(res, result);
});

export const getCustomers = catchAsync(async (req: Request, res: Response) => {
  const result = await analyticsCustomersService.getCustomerAnalytics(req.query as any);
  return sendSuccess(res, result);
});

export const getPayments = catchAsync(async (req: Request, res: Response) => {
  const result = await analyticsPaymentsService.getPaymentAnalytics(req.query as any);
  return sendSuccess(res, result);
});
