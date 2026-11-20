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
    const order = await ordersService.updateOrderPayment(
      id,
      body?.paymentStatus,
      body?.collectedBy,
      actor
    );
    return apiJson(req, {
      success: true,
      order,
      message: `Payment status updated to ${String(body?.paymentStatus || '').toUpperCase()}.`,
    });
  }
);
