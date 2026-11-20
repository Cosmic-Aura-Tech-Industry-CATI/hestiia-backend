import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { categoriesService } from '@/services/categories.service';

export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'superadmin', 'manager');

  const body = await req.json();
  const category = await categoriesService.createCategory(body, user.username);
  return apiJson(
    req,
    {
      success: true,
      category,
      message: `Category '${category.name}' created successfully.`,
    },
    201
  );
});
