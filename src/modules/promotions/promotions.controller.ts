import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { promotionsService } from './promotions.service.js';

export const getPublicPromotions = catchAsync(async (_req: Request, res: Response) => {
  const promotions = await promotionsService.getPublicPromotions();
  res.status(200).json({ success: true, promotions });
});

export const getAdminPromotions = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const promotions = await promotionsService.getAdminPromotions();
  res.status(200).json({ success: true, promotions });
});

export const createPromotion = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const promotion = await promotionsService.createPromotion(req.body, req.user?.username);
  res.status(201).json({
    success: true,
    promotion,
    message: 'Dining offer created successfully.',
  });
});

export const updatePromotion = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const promotion = await promotionsService.updatePromotion(req.params.id, req.body, req.user?.username);
  res.status(200).json({
    success: true,
    promotion,
    message: 'Promotion updated successfully.',
  });
});

export const deletePromotion = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  await promotionsService.deletePromotion(req.params.id, req.user?.username);
  res.status(200).json({
    success: true,
    message: 'Promotion removed successfully.',
  });
});
