import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { partyService } from './party.service.js';

export const createInquiry = catchAsync(async (req: Request, res: Response) => {
  const result = await partyService.createInquiry(req.body);
  res.status(201).json({
    success: true,
    inquiryId: result.inquiryId,
    message: 'Your party and banquet inquiry has been logged! Our banquet coordinator will contact you promptly.',
    inquiry: result.inquiry,
  });
});

export const getAdminInquiries = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await partyService.getAdminInquiries(req.query);
  res.status(200).json({ success: true, ...result });
});

export const updateInquiryStatus = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user?.name || req.user?.username || 'Staff';
  const inquiry = await partyService.updateInquiryStatus(req.params.id, req.body, actor);
  res.status(200).json({
    success: true,
    inquiry,
    message: 'Party inquiry updated successfully.',
  });
});
