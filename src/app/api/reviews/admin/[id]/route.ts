import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { reviewsService } from '@/services/reviews.service';

export const DELETE = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    requireRole(user, 'superadmin', 'manager');

    const { id } = await context.params;
    await reviewsService.deleteReview(id, user.username);
    return apiJson(req, {
      success: true,
      message: 'Review removed.',
    });
  }
);
