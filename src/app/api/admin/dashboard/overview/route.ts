import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { dashboardService } from '@/services/dashboard.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const data = await dashboardService.getOverview();
  return apiJson(req, { success: true, ...data });
});
