import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { promotionsService } from '@/services/promotions.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const promotions = await promotionsService.getAdminPromotions();
  return apiJson(req, { success: true, promotions });
});
