import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { bookingsService } from '@/services/bookings.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const result = await bookingsService.getAdminBookings({
    search: sp.get('search') || undefined,
    status: sp.get('status') || undefined,
    date: sp.get('date') || undefined,
    page: sp.get('page') || undefined,
    limit: sp.get('limit') || undefined,
  });
  return apiJson(req, { success: true, ...result });
});
