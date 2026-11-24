import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { sendSuccess, sendCreated } from '../../shared/responses/index.js';
import { notificationsService } from './notifications.service.js';
import type { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';

export const getNotifications = catchAsync(async (req: Request, res: Response) => {
  const result = await notificationsService.getNotifications(req.query as any);
  sendSuccess(res, result);
});

export const createNotification = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const notification = await notificationsService.createNotification(req.body);
  sendCreated(res, { notification }, 'Notification dispatched successfully');
});

export const markAsRead = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const notification = await notificationsService.markAsRead(id);
  sendSuccess(res, { notification }, 200, 'Notification marked as read');
});

export const markAllAsRead = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const recipientId = (req.body?.recipientId as string) || (req.query?.recipientId as string);
  const recipientType = (req.body?.recipientType as any) || (req.query?.recipientType as any) || 'admin';
  const result = await notificationsService.markAllAsRead(recipientId, recipientType);
  sendSuccess(res, result, 200, `${result.modifiedCount} notifications marked as read`);
});

export const getStatus = catchAsync(async (_req: Request, res: Response) => {
  const status = await notificationsService.getStatus();
  sendSuccess(res, status);
});
