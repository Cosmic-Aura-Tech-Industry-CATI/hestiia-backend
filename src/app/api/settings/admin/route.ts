import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { settingsService } from '@/services/settings.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const settings = await settingsService.getAdminSettings();
  return apiJson(req, { success: true, settings });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'superadmin');

  const body = await req.json();
  const settings = await settingsService.updateSettings(body, user.username);
  return apiJson(req, {
    success: true,
    settings,
    message: 'Restaurant settings saved successfully.',
  });
});
