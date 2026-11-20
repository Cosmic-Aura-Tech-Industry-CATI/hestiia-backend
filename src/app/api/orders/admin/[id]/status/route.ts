import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { ordersService } from '@/services/orders.service';

export const PATCH = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    const actor = user.name || user.username || 'Staff';
    const order = await ordersService.updateOrderStatus(
      id,
      body?.status,
      body?.note,
      actor
    );
    return apiJson(req, {
      success: true,
      order,
      message: `Order status updated to ${String(body?.status || '').toUpperCase()}.`,
    });
  }
);
