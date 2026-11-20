import { NextRequest } from 'next/server';
import { apiJson, withApiHandler } from '@/lib/errors';
import { categoriesService } from '@/services/categories.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  const categories = await categoriesService.getPublicCategories();
  return apiJson(req, { success: true, categories });
});
