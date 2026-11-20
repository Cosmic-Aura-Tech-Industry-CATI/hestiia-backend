import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { customersService } from '@/services/customers.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const result = await customersService.getCustomers({
    search: sp.get('search') || undefined,
    page: sp.get('page') || undefined,
    limit: sp.get('limit') || undefined,
    sortBy: sp.get('sortBy') || undefined,
  });
  return apiJson(req, { success: true, ...result });
});
