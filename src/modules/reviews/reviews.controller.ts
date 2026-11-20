import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { reviewsService } from './reviews.service.js';

export const getPublicReviews = catchAsync(async (_req: Request, res: Response) => {
  const reviews = await reviewsService.getPublicReviews();
  res.status(200).json({ success: true, reviews });
});

export const submitReview = catchAsync(async (req: Request, res: Response) => {
  const review = await reviewsService.submitReview(req.body);
  res.status(201).json({
    success: true,
    message: 'Thank you for your review! Our management team values your feedback.',
    review,
  });
});

export const getAdminReviews = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const reviews = await reviewsService.getAdminReviews(req.query);
  res.status(200).json({ success: true, reviews });
});

export const toggleApproval = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const review = await reviewsService.toggleApproval(req.params.id, req.body.isApproved, req.user?.username);
  res.status(200).json({
    success: true,
    review,
    message: 'Review approval status updated.',
  });
});

export const replyReview = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const review = await reviewsService.replyReview(req.params.id, req.body.staffReply, req.user?.username);
  res.status(200).json({
    success: true,
    review,
    message: 'Official staff response recorded.',
  });
});

export const deleteReview = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  await reviewsService.deleteReview(req.params.id, req.user?.username);
  res.status(200).json({
    success: true,
    message: 'Review removed.',
  });
});
