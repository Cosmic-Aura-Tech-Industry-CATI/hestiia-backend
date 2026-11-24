import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { sendSuccess, sendCreated } from '../../shared/responses/index.js';
import { pricingService } from './pricing.service.js';

export const calculateBillQuote = catchAsync(async (req: Request, res: Response) => {
  const quote = await pricingService.calculateBillQuote(req.body);
  sendSuccess(res, quote);
});

export const getPublicPricingRules = catchAsync(async (_req: Request, res: Response) => {
  const rules = await pricingService.getActiveRules();
  sendSuccess(res, { count: rules.length, rules });
});

export const getTaxEstimate = catchAsync(async (req: Request, res: Response) => {
  const amount = Number(req.query.amount) || 0;
  const estimate = pricingService.getTaxEstimate(amount);
  sendSuccess(res, estimate);
});

export const getAdminPricingRules = catchAsync(async (_req: Request, res: Response) => {
  const rules = await pricingService.getAllRules();
  sendSuccess(res, { count: rules.length, rules });
});

export const createPricingRule = catchAsync(async (req: Request, res: Response) => {
  const rule = await pricingService.createRule(req.body);
  sendCreated(res, { rule }, 'Pricing rule created successfully');
});

export const updatePricingRule = catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rule = await pricingService.updateRule(id, req.body);
  sendSuccess(res, { rule }, 200, 'Pricing rule updated successfully');
});

export const deletePricingRule = catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await pricingService.deleteRule(id);
  sendSuccess(res, null, 200, 'Pricing rule deleted successfully');
});

export const getStatus = catchAsync(async (_req: Request, res: Response) => {
  const status = await pricingService.getStatus();
  sendSuccess(res, status);
});
