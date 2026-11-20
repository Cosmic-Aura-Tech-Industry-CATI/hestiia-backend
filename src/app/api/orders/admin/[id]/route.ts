import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { ordersService } from '@/services/orders.service';

export const GET = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await context.params;
    const result = await ordersService.getOrderDetails(id);
    return apiJson(req, { success: true, ...result });
  }
);
