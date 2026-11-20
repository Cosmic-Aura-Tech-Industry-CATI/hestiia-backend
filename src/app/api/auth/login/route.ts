import { NextRequest } from 'next/server';
import { enforceAuthRateLimit, getClientIp } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { authService } from '@/services/auth.service';

export const POST = withApiHandler(async (req: NextRequest) => {
  const ip = getClientIp(req);
  await enforceAuthRateLimit(ip, 'login', 20);

  const body = await req.json();
  const { token, user } = await authService.login(body?.username, body?.password, ip);

  return apiJson(req, {
    success: true,
    message: 'Welcome back to Hestiia Restaurant Administration.',
    token,
    user,
  });
});
