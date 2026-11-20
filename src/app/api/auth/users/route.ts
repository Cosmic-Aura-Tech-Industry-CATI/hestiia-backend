import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { authService } from '@/services/auth.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'superadmin');

  const users = await authService.getAllUsers();
  return apiJson(req, { success: true, users });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const currentUser = await requireAuth(req);
  requireRole(currentUser, 'superadmin');

  const body = await req.json();
  const user = await authService.createUser(body, currentUser.username || 'admin');
  return apiJson(
    req,
    { success: true, user, message: 'Staff user created successfully.' },
    201
  );
});
