import { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { galleryService } from '@/services/gallery.service';

export const PUT = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    requireRole(user, 'superadmin', 'manager');

    const { id } = await context.params;
    const body = await req.json();
    const photo = await galleryService.updatePhoto(id, body, user.username);
    return apiJson(req, {
      success: true,
      photo,
      message: 'Gallery photo updated successfully.',
    });
  }
);

export const DELETE = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    requireRole(user, 'superadmin', 'manager');

    const { id } = await context.params;
    await galleryService.deletePhoto(id, user.username);
    return apiJson(req, {
      success: true,
      message: 'Photo deleted from gallery.',
    });
  }
);
