import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { reportsService } from './reports.service.js';

export const getAnalytics = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await reportsService.getAnalytics(String(req.query.period || '30days'));
  res.status(200).json({ success: true, ...result });
});

export const exportOrdersCsv = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const csvContent = await reportsService.exportOrdersCsv();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="hestiia_orders_report.csv"');
  res.send(csvContent);
});

export const exportCustomersCsv = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const csvContent = await reportsService.exportCustomersCsv();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="hestiia_customers_report.csv"');
  res.send(csvContent);
});
