import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { AppError } from '../../shared/utils/appError.js';
import { uploadService } from './upload.service.js';
import { sendSuccess } from '../../shared/responses/index.js';

export const uploadImage = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    throw new AppError('No image file was uploaded.', 400);
  }

  const folder = (req.body.folder as string) || (req.query.folder as string) || 'hestiia_restaurant/media';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const result = await uploadService.processAndUpload(req.file, {
    folder,
    username: req.user?.username || req.user?.email || 'admin',
    clientIp: ip,
  });

  // Dual format: maintains 100% backward compatible root properties expected by existing clients
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
    mimeType: result.mimeType,
    originalName: result.originalName,
    message:
      result.provider === 'cloudinary'
        ? 'Image processed and uploaded to Cloudinary CDN successfully.'
        : 'Image uploaded to local storage successfully.',
  });
});

export const uploadMultiple = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) {
    throw new AppError('No files were provided for multiple upload.', 400);
  }

  const folder = (req.body.folder as string) || (req.query.folder as string) || 'hestiia_restaurant/media';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const result = await uploadService.processMultiple(files, {
    folder,
    username: req.user?.username || req.user?.email || 'admin',
    clientIp: ip,
  });

  sendSuccess(res, result, 201, `Successfully uploaded ${result.count} images.`);
});

export const deleteUploadedFile = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
  const actor = req.user?.name || req.user?.username || 'Superadmin';
  const result = await uploadService.deleteFile(filename, actor);
  sendSuccess(res, result, 200, result.message);
});

export const getStorageStats = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const stats = await uploadService.getStorageStats();
  sendSuccess(res, stats);
});

export const getStatus = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const status = await uploadService.getStatus();
  sendSuccess(res, status);
});
