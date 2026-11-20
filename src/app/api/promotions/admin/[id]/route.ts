import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { promotionsService } from '@/services/promotions.service';

export const PUT = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    requireRole(user, 'superadmin', 'manager');

    const { id } = await context.params;
    const body = await req.json();
    const promotion = await promotionsService.updatePromotion(id, body, user.username);
    return apiJson(req, {
      success: true,
      promotion,
      message: 'Dining offer updated successfully.',
    });
  }
);

export const DELETE = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    requireRole(user, 'superadmin', 'manager');

    const { id } = await context.params;
    await promotionsService.deletePromotion(id, user.username);
    return apiJson(req, {
      success: true,
      message: 'Promotion offer removed.',
    });
  }
);
