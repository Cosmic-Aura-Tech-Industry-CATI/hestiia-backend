import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { galleryService } from '@/services/gallery.service';

export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireRole(user, 'superadmin', 'manager');

  const body = await req.json();
  const photo = await galleryService.addPhoto(body, user.username);
  return apiJson(
    req,
    {
      success: true,
      photo,
      message: 'Photo added to ambience gallery.',
    },
    201
  );
});
