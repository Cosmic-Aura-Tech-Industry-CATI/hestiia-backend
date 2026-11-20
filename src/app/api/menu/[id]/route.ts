import { NextRequest } from 'next/server';
import { apiJson, withApiHandler } from '@/lib/errors';
import { menuService } from '@/services/menu.service';

export const GET = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const dish = await menuService.getDishById(id);
    return apiJson(req, { success: true, dish });
  }
);
