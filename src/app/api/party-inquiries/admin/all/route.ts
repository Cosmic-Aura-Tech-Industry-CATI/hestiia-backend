import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { partyService } from '@/services/party.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const result = await partyService.getAdminInquiries({
    search: sp.get('search') || undefined,
    status: sp.get('status') || undefined,
    eventType: sp.get('eventType') || undefined,
    page: sp.get('page') || undefined,
    limit: sp.get('limit') || undefined,
  });
  return apiJson(req, { success: true, ...result });
});
