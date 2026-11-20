import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCorsHeaders, withApiHandler } from '@/lib/errors';
import { reportsService } from '@/services/reports.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const csvContent = await reportsService.exportOrdersCsv();
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hestiia_orders_report.csv"',
    },
  });
});
