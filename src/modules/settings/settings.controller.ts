import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { settingsService } from './settings.service.js';

export const getPublicSettings = catchAsync(async (_req: Request, res: Response) => {
  const settings = await settingsService.getPublicSettings();
  res.status(200).json({ success: true, settings });
});

export const getAdminSettings = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const settings = await settingsService.getAdminSettings();
  res.status(200).json({ success: true, settings });
});

export const updateSettings = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const settings = await settingsService.updateSettings(req.body, req.user?.username);
  res.status(200).json({
    success: true,
    settings,
    message: 'Restaurant settings saved successfully.',
  });
});
