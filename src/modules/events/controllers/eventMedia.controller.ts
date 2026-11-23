import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/utils/index.js';
import { sendSuccess } from '../../../shared/responses/index.js';
import { AppError } from '../../../shared/utils/appError.js';
import { eventMediaService } from '../services/eventMedia.service.js';

export const eventMediaController = {
  /**
   * Upload multiple photographs for an event
   */
  uploadPhotos: catchAsync(async (req: Request, res: Response) => {
    const eventId = String(req.params.eventId || req.params.id);
    let files: Express.Multer.File[] = [];

    if (Array.isArray(req.files)) {
      files = req.files as Express.Multer.File[];
    } else if (req.files && typeof req.files === 'object') {
      const fileMap = req.files as { [fieldname: string]: Express.Multer.File[] };
      for (const field of Object.keys(fileMap)) {
        if (Array.isArray(fileMap[field])) {
          files.push(...fileMap[field]);
        }
      }
    } else if (req.file) {
      files = [req.file];
    }

    if (!files || files.length === 0) {
      throw new AppError('No photo files provided for upload.', 400);
    }

    const username = (req as any).user?.username || (req as any).user?.name || 'admin';
    const media = await eventMediaService.uploadEventMedia(eventId, files, username);
    sendSuccess(res, { media }, 201, `Successfully uploaded ${media.length} photograph(s)`);
  }),

  /**
   * Get all photographs for an event
   */
  getPhotos: catchAsync(async (req: Request, res: Response) => {
    const eventId = String(req.params.eventId || req.params.id);
    const media = await eventMediaService.getEventMedia(eventId);
    sendSuccess(res, { media });
  }),

  /**
   * Delete a single photograph
   */
  deletePhoto: catchAsync(async (req: Request, res: Response) => {
    const eventId = String(req.params.eventId || req.params.id);
    const mediaId = String(req.params.mediaId);
    const username = (req as any).user?.username || (req as any).user?.name || 'admin';
    const result = await eventMediaService.deleteMedia(eventId, mediaId, username);
    sendSuccess(res, result, 200, 'Photograph deleted successfully');
  }),

  /**
   * Set photograph as cover image
   */
  setCover: catchAsync(async (req: Request, res: Response) => {
    const eventId = String(req.params.eventId || req.params.id);
    const mediaId = String(req.params.mediaId);
    const username = (req as any).user?.username || (req as any).user?.name || 'admin';
    const media = await eventMediaService.setCoverImage(eventId, mediaId, username);
    sendSuccess(res, { media }, 200, 'Cover image updated successfully');
  }),

  /**
   * Reorder photographs
   */
  reorderPhotos: catchAsync(async (req: Request, res: Response) => {
    const eventId = String(req.params.eventId || req.params.id);
    const { orderedMediaIds } = req.body;
    const username = (req as any).user?.username || (req as any).user?.name || 'admin';
    const media = await eventMediaService.reorderMedia(eventId, orderedMediaIds, username);
    sendSuccess(res, { media }, 200, 'Photographs reordered successfully');
  }),
};

export default eventMediaController;
