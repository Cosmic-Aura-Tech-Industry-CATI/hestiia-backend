import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { menuService } from '@/services/menu.service';

export const PUT = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    requireRole(user, 'superadmin', 'manager');

    const { id } = await context.params;
    const body = await req.json();
    const dish = await menuService.updateDish(id, body, user.username);
    return apiJson(req, {
      success: true,
      dish,
      message: `${dish.name} updated successfully.`,
    });
  }
);

export const DELETE = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    requireRole(user, 'superadmin');

    const { id } = await context.params;
    const result = await menuService.deleteDish(id, user.username);
    return apiJson(req, { success: true, ...result });
  }
);
