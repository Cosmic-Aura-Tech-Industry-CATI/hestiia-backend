import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { paymentsService } from '@/services/payments.service';

export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await req.json();
  const actor = user.name || user.username || 'Staff';
  await paymentsService.recordCollection(body, actor);
  return apiJson(req, {
    success: true,
    message: `Payment for order ${body?.orderNumber || ''} recorded as paid.`,
  });
});
