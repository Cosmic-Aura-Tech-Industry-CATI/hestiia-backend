import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';

export const GET = withApiHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  return apiJson(req, {
    success: true,
    user,
  });
});
