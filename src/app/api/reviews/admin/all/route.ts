import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { reviewsService } from '@/services/reviews.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const reviews = await reviewsService.getAdminReviews({
    status: sp.get('status') || undefined,
    rating: sp.get('rating') || undefined,
    search: sp.get('search') || undefined,
  });
  return apiJson(req, { success: true, reviews });
});
