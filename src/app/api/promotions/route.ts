import { NextRequest } from 'next/server';
import { apiJson, withApiHandler } from '@/lib/errors';
import { promotionsService } from '@/services/promotions.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  const promotions = await promotionsService.getPublicPromotions();
  return apiJson(req, { success: true, promotions });
});
