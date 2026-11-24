import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { sendSuccess } from '../../shared/responses/index.js';
import { loyaltyService } from './loyalty.service.js';

export const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const phone = (req.query.phone as string) || (req as any).user?.phone;
  const profile = await loyaltyService.getProfile(phone);
  sendSuccess(res, profile);
});

export const getRewardsCatalog = catchAsync(async (_req: Request, res: Response) => {
  const catalog = await loyaltyService.getRewardsCatalog();
  sendSuccess(res, catalog);
});

export const redeemPoints = catchAsync(async (req: Request, res: Response) => {
  const phone = req.body.phone || (req as any).user?.phone;
  const { points, orderNumber } = req.body;
  const result = await loyaltyService.redeemPoints(phone, points, orderNumber);
  sendSuccess(res, result, 200, 'Loyalty points redeemed successfully');
});

export const redeemVoucher = catchAsync(async (req: Request, res: Response) => {
  const phone = req.body.phone || (req as any).user?.phone;
  const { voucherId } = req.body;
  const result = await loyaltyService.redeemRewardVoucher(phone, voucherId);
  sendSuccess(res, result, 200, 'Reward voucher redeemed successfully');
});

export const getCustomerProfile = catchAsync(async (req: Request, res: Response) => {
  const idOrPhone = Array.isArray(req.params.idOrPhone)
    ? req.params.idOrPhone[0]
    : req.params.idOrPhone;
  const profile = await loyaltyService.getProfile(idOrPhone);
  sendSuccess(res, profile);
});

export const manualAdjustment = catchAsync(async (req: Request, res: Response) => {
  const { phone, points, reason } = req.body;
  const result = await loyaltyService.manualPointsAdjustment(
    phone,
    points,
    reason,
    (req as any).user
  );
  sendSuccess(res, result, 200, 'Points adjustment recorded successfully');
});

export const getLoyaltyStats = catchAsync(async (_req: Request, res: Response) => {
  const stats = await loyaltyService.getLoyaltyStats();
  sendSuccess(res, { stats });
});

export const getStatus = catchAsync(async (_req: Request, res: Response) => {
  const status = await loyaltyService.getStatus();
  sendSuccess(res, status);
});
