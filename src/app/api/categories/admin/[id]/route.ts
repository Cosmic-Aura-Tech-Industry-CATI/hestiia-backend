import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { categoriesService } from '@/services/categories.service';

export const PUT = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    requireRole(user, 'superadmin', 'manager');

    const { id } = await context.params;
    const body = await req.json();
    const category = await categoriesService.updateCategory(id, body, user.username);
    return apiJson(req, {
      success: true,
      category,
      message: 'Category updated successfully.',
    });
  }
);

export const DELETE = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    requireRole(user, 'superadmin');

    const { id } = await context.params;
    const { name } = await categoriesService.deleteCategory(id, user.username);
    return apiJson(req, {
      success: true,
      message: `Category '${name}' deleted successfully.`,
    });
  }
);
