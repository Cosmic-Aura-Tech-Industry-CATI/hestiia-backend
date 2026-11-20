import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { paymentsService } from '@/services/payments.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const result = await paymentsService.getPayments({
    search: sp.get('search') || undefined,
    paymentStatus: sp.get('paymentStatus') || undefined,
    paymentMethod: sp.get('paymentMethod') || undefined,
    page: sp.get('page') || undefined,
    limit: sp.get('limit') || undefined,
  });
  return apiJson(req, { success: true, ...result });
});
