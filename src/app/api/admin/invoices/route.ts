import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { invoicesService } from '@/services/invoices.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const result = await invoicesService.getInvoices({
    search: sp.get('search') || undefined,
    page: sp.get('page') || undefined,
    limit: sp.get('limit') || undefined,
  });
  return apiJson(req, { success: true, ...result });
});
