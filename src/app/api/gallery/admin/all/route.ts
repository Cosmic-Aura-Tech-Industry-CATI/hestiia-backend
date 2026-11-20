import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { galleryService } from '@/services/gallery.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const gallery = await galleryService.getAdminGallery();
  return apiJson(req, { success: true, gallery });
});
