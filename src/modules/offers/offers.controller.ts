import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { sendSuccess, sendCreated } from '../../shared/responses/index.js';
import { offersService } from './offers.service.js';

export const getPublicOffers = catchAsync(async (_req: Request, res: Response) => {
  const offers = await offersService.getPublicOffers();
  sendSuccess(res, { count: offers.length, offers });
});

export const getBannerOffers = catchAsync(async (_req: Request, res: Response) => {
  const banners = await offersService.getBannerOffers();
  sendSuccess(res, { count: banners.length, banners });
});

export const validateCoupon = catchAsync(async (req: Request, res: Response) => {
  const { code, subtotalPaise, subtotal, fulfillmentType } = req.body;
  const calculatedPaise =
    subtotalPaise !== undefined ? Number(subtotalPaise) : Math.round((Number(subtotal) || 0) * 100);

  const result = await offersService.validateAndCalculateDiscount(
    code,
    calculatedPaise,
    fulfillmentType
  );
  sendSuccess(res, result, 200, result.message);
});

export const getOfferByCode = catchAsync(async (req: Request, res: Response) => {
  const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
  const offer = await offersService.getOfferByCode(code);
  sendSuccess(res, { offer });
});

export const getAdminOffers = catchAsync(async (req: Request, res: Response) => {
  const result = await offersService.getAdminOffers(req.query);
  sendSuccess(res, result);
});

export const createOffer = catchAsync(async (req: Request, res: Response) => {
  const offer = await offersService.createOffer(req.body, (req as any).user);
  sendCreated(res, { offer }, 'Promotional offer created successfully');
});

export const updateOffer = catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const offer = await offersService.updateOffer(id, req.body, (req as any).user);
  sendSuccess(res, { offer }, 200, 'Promotional offer updated successfully');
});

export const deleteOffer = catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await offersService.deleteOffer(id);
  sendSuccess(res, null, 200, 'Promotional offer deleted successfully');
});

export const getOffersStats = catchAsync(async (_req: Request, res: Response) => {
  const stats = await offersService.getOffersStats();
  sendSuccess(res, { stats });
});

export const getStatus = catchAsync(async (_req: Request, res: Response) => {
  const status = await offersService.getStatus();
  sendSuccess(res, status);
});
