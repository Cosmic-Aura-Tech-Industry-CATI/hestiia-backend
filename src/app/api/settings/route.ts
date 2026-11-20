import { NextRequest } from 'next/server';
import { apiJson, withApiHandler } from '@/lib/errors';
import { settingsService } from '@/services/settings.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  const settings = await settingsService.getPublicSettings();
  return apiJson(req, { success: true, settings });
});
