import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { reportsService } from '@/services/reports.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const period = req.nextUrl.searchParams.get('period') || '30days';
  const result = await reportsService.getAnalytics(period);
  return apiJson(req, { success: true, ...result });
});
