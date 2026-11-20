import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { invoicesService } from './invoices.service.js';

export const getInvoices = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await invoicesService.getInvoices(req.query);
  res.status(200).json({ success: true, ...result });
});

export const getInvoiceDetails = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await invoicesService.getInvoiceDetails(req.params.identifier);
  res.status(200).json({ success: true, ...result });
});
