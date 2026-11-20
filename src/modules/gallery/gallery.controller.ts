import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { galleryService } from './gallery.service.js';

export const getPublicGallery = catchAsync(async (_req: Request, res: Response) => {
  const gallery = await galleryService.getPublicGallery();
  res.status(200).json({ success: true, gallery });
});

export const getAdminGallery = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const gallery = await galleryService.getAdminGallery();
  res.status(200).json({ success: true, gallery });
});

export const addPhoto = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const photo = await galleryService.addPhoto(req.body, req.user?.username);
  res.status(201).json({
    success: true,
    photo,
    message: 'Photo added to ambience gallery.',
  });
});

export const updatePhoto = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const photo = await galleryService.updatePhoto(req.params.id, req.body, req.user?.username);
  res.status(200).json({
    success: true,
    photo,
    message: 'Gallery photo updated successfully.',
  });
});

export const deletePhoto = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  await galleryService.deletePhoto(req.params.id, req.user?.username);
  res.status(200).json({
    success: true,
    message: 'Photo deleted from gallery.',
  });
});
