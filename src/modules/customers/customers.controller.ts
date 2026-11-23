import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { customersService } from './customers.service.js';

export const getCustomers = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await customersService.getCustomers(req.query);
  res.status(200).json({ success: true, ...result });
});

export const getCustomerById = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await customersService.getCustomerById(String(req.params.id));
  res.status(200).json({ success: true, ...result });
});

export const createCustomer = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const customer = await customersService.createCustomer(req.body, req.user?.username);
  res.status(201).json({
    success: true,
    customer,
    message: `Customer ${customer.name} created successfully.`,
  });
});

export const updateCustomer = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const customer = await customersService.updateCustomer(String(req.params.id), req.body, req.user?.username);
  res.status(200).json({
    success: true,
    customer,
    message: `Customer ${customer.name} updated successfully.`,
  });
});

export const deleteCustomer = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await customersService.deleteCustomer(String(req.params.id), req.user?.username);
  res.status(200).json({
    success: true,
    ...result,
  });
});

export const getCustomerStats = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const stats = await customersService.getCustomerStats();
  res.status(200).json({ success: true, stats });
});
