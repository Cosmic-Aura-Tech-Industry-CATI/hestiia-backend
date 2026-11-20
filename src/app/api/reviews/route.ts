import { NextRequest } from 'next/server';
import { apiJson, withApiHandler } from '@/lib/errors';
import { reviewsService } from '@/services/reviews.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  const reviews = await reviewsService.getPublicReviews();
  return apiJson(req, { success: true, reviews });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const review = await reviewsService.submitReview(body);
  return apiJson(
    req,
    {
      success: true,
      message:
        'Thank you for your review! Our management team values your feedback.',
      review,
    },
    201
  );
});
