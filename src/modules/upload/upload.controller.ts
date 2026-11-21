import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { AppError } from '../../shared/utils/appError.js';
import { uploadService } from './upload.service.js';

export const uploadImage = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    throw new AppError('No image file was uploaded.', 400);
  }

  const folder = (req.body.folder as string) || (req.query.folder as string) || 'hestiia_restaurant/media';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const result = await uploadService.processAndUpload(req.file, {
    folder,
    username: req.user?.username || 'admin',
    clientIp: ip,
  });

  res.status(201).json({
    success: true,
    url: result.url,
    filename: result.filename,
    size: result.size,
    provider: result.provider,
    publicId: result.publicId,
    format: result.format,
    width: result.width,
    height: result.height,
    message:
      result.provider === 'cloudinary'
        ? 'Image processed and uploaded to Cloudinary CDN successfully.'
        : 'Image uploaded to local storage successfully.',
  });
});
