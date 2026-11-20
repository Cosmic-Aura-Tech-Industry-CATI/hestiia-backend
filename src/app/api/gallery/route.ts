import { NextRequest } from 'next/server';
import { apiJson, withApiHandler } from '@/lib/errors';
import { galleryService } from '@/services/gallery.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  const gallery = await galleryService.getPublicGallery();
  return apiJson(req, { success: true, gallery });
});
