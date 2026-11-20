import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { apiJson, AppError, withApiHandler } from '@/lib/errors';

export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const formData = await req.formData();
  const file = formData.get('image');

  if (!file || !(file instanceof File)) {
    throw new AppError('No image file was uploaded.', 400);
  }

  const uploaded = await uploadImageToCloudinary(file, 'uploads');

  await logAudit(
    'IMAGE_UPLOADED',
    user.username || 'admin',
    `Uploaded image to Cloudinary: ${uploaded.publicId} (${Math.round(uploaded.size / 1024)} KB)`
  );

  return apiJson(
    req,
    {
      success: true,
      url: uploaded.url,
      publicId: uploaded.publicId,
      filename: uploaded.filename,
      size: uploaded.size,
      message: 'Image uploaded successfully.',
    },
    201
  );
});
