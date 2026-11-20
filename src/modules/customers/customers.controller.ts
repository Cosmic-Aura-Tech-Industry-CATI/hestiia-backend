import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { customersService } from './customers.service.js';

export const getCustomers = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await customersService.getCustomers(req.query);
  res.status(200).json({ success: true, ...result });
});

export const getCustomerById = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await customersService.getCustomerById(req.params.id);
  res.status(200).json({ success: true, ...result });
});
