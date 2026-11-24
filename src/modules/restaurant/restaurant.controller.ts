import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { sendSuccess } from '../../shared/responses/index.js';
import { restaurantService } from './restaurant.service.js';
import type { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';

export const getPublicProfile = catchAsync(async (_req: Request, res: Response) => {
  const profile = await restaurantService.getPublicProfile();
  sendSuccess(res, { restaurant: profile });
});

export const getOperationalStatus = catchAsync(async (_req: Request, res: Response) => {
  const status = await restaurantService.getOperationalStatus();
  sendSuccess(res, status);
});

export const getAdminDetails = catchAsync(async (_req: Request, res: Response) => {
  const details = await restaurantService.getInfo();
  sendSuccess(res, { restaurant: details });
});

export const updateRestaurant = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const username = req.user?.username || req.user?.email || 'admin';
  const updated = await restaurantService.updateInfo(req.body, username);
  sendSuccess(res, { restaurant: updated }, 200, 'Restaurant details updated successfully');
});

export const toggleOrderAcceptance = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const username = req.user?.username || req.user?.email || 'staff';
  const { enabled, reason } = req.body || {};
  const result = await restaurantService.toggleOrderAcceptance(enabled, username, reason);
  sendSuccess(res, result, 200, result.message);
});

export const toggleTableReservation = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const username = req.user?.username || req.user?.email || 'staff';
  const { enabled, reason } = req.body || {};
  const result = await restaurantService.toggleTableReservation(enabled, username, reason);
  sendSuccess(res, result, 200, result.message);
});
