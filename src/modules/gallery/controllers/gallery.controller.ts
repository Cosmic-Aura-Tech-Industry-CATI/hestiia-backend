import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/utils/index.js';
import { sendSuccess } from '../../../shared/responses/index.js';
import { galleryService } from '../services/gallery.service.js';

export const galleryController = {
  /**
   * Public: List published gallery photos
   */
  getPublicPhotos: catchAsync(async (req: Request, res: Response) => {
    const result = await galleryService.getPublicPhotos(req.query);
    sendSuccess(res, result);
  }),

  /**
   * Public: Get published photo by ID
   */
  getPublicPhotoById: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const photo = await galleryService.getPublicPhotoById(id);
    sendSuccess(res, { photo });
  }),

  /**
   * Admin: Upload official photo
   */
  uploadOfficialPhoto: catchAsync(async (req: Request, res: Response) => {
    const adminUsername = (req as any).user?.username || (req as any).user?.name || 'admin';
    const file = req.file || (req.files && (req.files as any)[0]);
    const photo = await galleryService.uploadOfficialPhoto(file, req.body, adminUsername);
    sendSuccess(res, { photo }, 201, 'Official photograph uploaded successfully');
  }),

  /**
   * Admin: List official photos
   */
  getAdminPhotos: catchAsync(async (req: Request, res: Response) => {
    const result = await galleryService.getAdminPhotos(req.query);
    sendSuccess(res, result);
  }),

  /**
   * Admin: Get official photo by ID
   */
  getAdminPhotoById: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const photo = await galleryService.getAdminPhotoById(id);
    sendSuccess(res, { photo });
  }),

  /**
   * Admin: Update photo metadata
   */
  updatePhoto: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminUsername = (req as any).user?.username || (req as any).user?.name || 'admin';
    const photo = await galleryService.updatePhoto(id, req.body, adminUsername);
    sendSuccess(res, { photo }, 200, 'Photograph updated successfully');
  }),

  /**
   * Admin: Change photo status (publish, unpublish, archive)
   */
  updatePhotoStatus: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminUsername = (req as any).user?.username || (req as any).user?.name || 'admin';
    const photo = await galleryService.updatePhotoStatus(id, req.body.status, adminUsername);
    sendSuccess(res, { photo }, 200, 'Photograph status updated successfully');
  }),

  /**
   * Admin: Delete photo permanently
   */
  deletePhoto: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminUsername = (req as any).user?.username || (req as any).user?.name || 'admin';
    const result = await galleryService.deletePhoto(id, adminUsername);
    sendSuccess(res, result, 200, result.message);
  }),
};

export default galleryController;
