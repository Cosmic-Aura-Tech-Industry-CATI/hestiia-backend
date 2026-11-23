import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { sendSuccess } from '../../shared/responses/index.js';
import { reportsService } from './reports.service.js';

export const getAnalytics = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const period = String(req.query.period || '30days');
  const customStart = req.query.startDate as string;
  const customEnd = req.query.endDate as string;
  const result = await reportsService.getAnalytics(period, customStart, customEnd);
  sendSuccess(res, result);
});

export const getTaxReport = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const period = String(req.query.period || '30days');
  const customStart = req.query.startDate as string;
  const customEnd = req.query.endDate as string;
  const result = await reportsService.getTaxReport(period, customStart, customEnd);
  sendSuccess(res, result);
});

export const exportOrdersCsv = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const customStart = req.query.startDate as string;
  const customEnd = req.query.endDate as string;
  const csvContent = await reportsService.exportOrdersCsv(customStart, customEnd);
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

export const exportTaxCsv = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const period = String(req.query.period || '30days');
  const csvContent = await reportsService.exportTaxCsv(period);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="hestiia_gst_tax_report.csv"');
  res.send(csvContent);
});

export const exportMenuPerformanceCsv = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const period = String(req.query.period || '30days');
  const csvContent = await reportsService.exportMenuPerformanceCsv(period);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="hestiia_menu_performance.csv"');
  res.send(csvContent);
});

export const getStatus = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const status = await reportsService.getStatus();
  sendSuccess(res, status);
});
