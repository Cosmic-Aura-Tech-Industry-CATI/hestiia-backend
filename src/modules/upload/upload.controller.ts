import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { AppError } from '../../shared/utils/appError.js';
import { db } from '../../shared/config/db.js';

export const uploadImage = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    throw new AppError('No image file was uploaded.', 400);
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  db.logAudit(
    'IMAGE_UPLOADED',
    req.user?.username || 'admin',
    `Uploaded file: ${req.file.filename} (${Math.round(req.file.size / 1024)} KB)`
  );

  res.status(201).json({
    success: true,
    url: fileUrl,
    filename: req.file.filename,
    size: req.file.size,
    message: 'Image uploaded successfully.',
  });
});
