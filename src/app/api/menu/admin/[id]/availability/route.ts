import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { menuService } from '@/services/menu.service';

export const PATCH = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    const { dish, statusText } = await menuService.toggleAvailability(
      id,
      body?.available,
      user.username
    );
    return apiJson(req, {
      success: true,
      dish,
      message: `${dish.name} is now marked as ${statusText}.`,
    });
  }
);
