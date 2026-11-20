import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { ordersService } from '@/services/orders.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const result = await ordersService.getAdminOrders({
    search: sp.get('search') || undefined,
    orderStatus: sp.get('orderStatus') || undefined,
    paymentStatus: sp.get('paymentStatus') || undefined,
    fulfillmentType: sp.get('fulfillmentType') || undefined,
    startDate: sp.get('startDate') || undefined,
    endDate: sp.get('endDate') || undefined,
    page: sp.get('page') || undefined,
    limit: sp.get('limit') || undefined,
  });
  return apiJson(req, { success: true, ...result });
});
