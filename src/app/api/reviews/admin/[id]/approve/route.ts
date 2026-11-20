import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { reviewsService } from '@/services/reviews.service';

export const PATCH = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    const review = await reviewsService.toggleApproval(
      id,
      body?.isApproved,
      user.username
    );
    return apiJson(req, {
      success: true,
      review,
      message: 'Review approval status updated.',
    });
  }
);
