import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { menuService } from '@/services/menu.service';

export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'superadmin', 'manager');

  const body = await req.json();
  const dish = await menuService.createDish(body, user.username);
  return apiJson(
    req,
    {
      success: true,
      dish,
      message: `${dish.name} has been added to the restaurant menu.`,
    },
    201
  );
});
