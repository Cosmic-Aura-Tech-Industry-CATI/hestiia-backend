import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { categoriesService } from '@/services/categories.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const categories = await categoriesService.getAdminCategories();
  return apiJson(req, { success: true, categories });
});
