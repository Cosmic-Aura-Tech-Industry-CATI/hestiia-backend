import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/utils/index.js';
import { sendSuccess } from '../../../shared/responses/index.js';
import { galleryService } from '../services/gallery.service.js';
import { mediaModerationService } from '../services/mediaModeration.service.js';

export const mediaModerationController = {
  /**
   * Admin: List customer photo uploads for review
   */
  getAdminCustomerUploads: catchAsync(async (req: Request, res: Response) => {
    const result = await galleryService.getAdminCustomerUploads(req.query);
    sendSuccess(res, result);
  }),

  /**
   * Admin: Get single customer submission details
   */
  getCustomerUploadById: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const submission = await galleryService.getAdminPhotoById(id);
    const moderationHistory = await mediaModerationService.getModerationHistory(id);
    sendSuccess(res, { submission, moderationHistory });
  }),

  /**
   * Admin: Moderate submission (approve, reject, remove)
   */
  moderateUpload: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminUsername = (req as any).user?.username || (req as any).user?.name || 'admin';
    const { action, reason } = req.body;
    const result = await mediaModerationService.moderatePhoto(id, action, adminUsername, reason);
    sendSuccess(res, result, 200, `Photo submission successfully ${action}`);
  }),

  /**
   * Admin: Delete inappropriate customer submission
   */
  deleteCustomerUpload: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminUsername = (req as any).user?.username || (req as any).user?.name || 'admin';
    const result = await galleryService.deletePhoto(id, adminUsername);
    sendSuccess(res, result, 200, 'Customer photograph deleted successfully');
  }),
};

export default mediaModerationController;
