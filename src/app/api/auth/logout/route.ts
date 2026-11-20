import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { authService } from '@/services/auth.service';

export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  await authService.logout(user.id, user.username || 'admin');

  const res = apiJson(req, {
    success: true,
    message: 'Logged out successfully.',
  });
  res.cookies.delete('admin_token');
  res.cookies.delete('accessToken');
  return res;
});
