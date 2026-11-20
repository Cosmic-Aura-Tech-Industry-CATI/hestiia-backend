import { NextRequest } from 'next/server';
import { enforceAuthRateLimit, getClientIp, requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { authService } from '@/services/auth.service';

export const POST = withApiHandler(async (req: NextRequest) => {
  const ip = getClientIp(req);
  await enforceAuthRateLimit(ip, 'change-password', 20);

  const user = await requireAuth(req);
  const body = await req.json();
  await authService.changePassword(user.id, body?.currentPassword, body?.newPassword);

  return apiJson(req, {
    success: true,
    message: 'Password updated successfully.',
  });
});
