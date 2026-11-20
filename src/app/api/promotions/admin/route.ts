import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { promotionsService } from '@/services/promotions.service';

export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'superadmin', 'manager');

  const body = await req.json();
  const promotion = await promotionsService.createPromotion(body, user.username);
  return apiJson(
    req,
    {
      success: true,
      promotion,
      message: 'Dining offer created successfully.',
    },
    201
  );
});
