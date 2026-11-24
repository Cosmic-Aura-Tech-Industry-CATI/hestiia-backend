import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { sendSuccess, sendCreated } from '../../shared/responses/index.js';
import { deliveryService } from './delivery.service.js';

export const checkServiceability = catchAsync(async (req: Request, res: Response) => {
  const pincode = req.query.pincode || req.body?.pincode;
  const address = req.query.address || req.body?.address;
  const result = await deliveryService.checkServiceability(pincode as string, address as string);
  sendSuccess(res, result);
});

export const assignRider = catchAsync(async (req: Request, res: Response) => {
  const orderNumber = Array.isArray(req.params.orderNumber)
    ? req.params.orderNumber[0]
    : req.params.orderNumber;
  const result = await deliveryService.assignRider(orderNumber, req.body, (req as any).user);
  sendCreated(res, { assignment: result }, 'Rider assigned to order successfully');
});

export const updateTrackingStatus = catchAsync(async (req: Request, res: Response) => {
  const orderNumber = Array.isArray(req.params.orderNumber)
    ? req.params.orderNumber[0]
    : req.params.orderNumber;
  const { status, location, notes } = req.body;
  const result = await deliveryService.updateTrackingStatus(orderNumber, status, location, notes);
  sendSuccess(res, { tracking: result }, 200, 'Tracking status updated successfully');
});

export const verifyDeliveryOtp = catchAsync(async (req: Request, res: Response) => {
  const orderNumber = Array.isArray(req.params.orderNumber)
    ? req.params.orderNumber[0]
    : req.params.orderNumber;
  const { otp } = req.body;
  const result = await deliveryService.verifyDeliveryOtp(orderNumber, otp);
  sendSuccess(res, { tracking: result }, 200, 'Delivery confirmed via OTP successfully');
});

export const getDeliveryByOrder = catchAsync(async (req: Request, res: Response) => {
  const orderNumber = Array.isArray(req.params.orderNumber)
    ? req.params.orderNumber[0]
    : req.params.orderNumber;
  const result = await deliveryService.getDeliveryByOrder(orderNumber);
  sendSuccess(res, { tracking: result });
});

export const getAllDeliveries = catchAsync(async (req: Request, res: Response) => {
  const result = await deliveryService.getAllDeliveries(req.query);
  sendSuccess(res, result);
});

export const getDeliveryStats = catchAsync(async (_req: Request, res: Response) => {
  const stats = await deliveryService.getDeliveryStats();
  sendSuccess(res, { stats });
});

export const getDeliveryZones = catchAsync(async (_req: Request, res: Response) => {
  const zones = await deliveryService.getDeliveryZones();
  sendSuccess(res, { zones });
});

export const updateDeliveryZones = catchAsync(async (req: Request, res: Response) => {
  const zones = await deliveryService.updateDeliveryZones(req.body.zones);
  sendSuccess(res, { zones }, 200, 'Delivery zones updated successfully');
});

export const getStatus = catchAsync(async (_req: Request, res: Response) => {
  const status = await deliveryService.getStatus();
  sendSuccess(res, status);
});
