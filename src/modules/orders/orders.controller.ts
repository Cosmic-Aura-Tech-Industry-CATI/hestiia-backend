import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { ordersService } from './orders.service.js';

export const createOrder = catchAsync(async (req: Request, res: Response) => {
  const { order, invoice } = await ordersService.createOrder(req.body);
  res.status(201).json({
    success: true,
    message: 'Your order has been received and sent to Hestiia kitchen!',
    order,
    invoice,
  });
});

export const getAdminOrders = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await ordersService.getAdminOrders(req.query);
  res.status(200).json({ success: true, ...result });
});

export const getOrderDetails = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await ordersService.getOrderDetails(req.params.id);
  res.status(200).json({ success: true, ...result });
});

export const updateOrderStatus = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user?.name || req.user?.username || 'Staff';
  const order = await ordersService.updateOrderStatus(req.params.id, req.body.status, req.body.note, actor);
  res.status(200).json({
    success: true,
    order,
    message: `Order status updated to ${req.body.status.toUpperCase()}.`,
  });
});

export const updateOrderPayment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user?.name || req.user?.username || 'Staff';
  const order = await ordersService.updateOrderPayment(req.params.id, req.body.paymentStatus, req.body.collectedBy, actor);
  res.status(200).json({
    success: true,
    order,
    message: `Payment status updated to ${req.body.paymentStatus.toUpperCase()}.`,
  });
});
