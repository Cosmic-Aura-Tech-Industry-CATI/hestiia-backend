import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/utils/index.js';
import { sendSuccess } from '../../../shared/responses/index.js';
import { mediaCategoryService } from '../services/mediaCategory.service.js';

export const mediaCategoryController = {
  /**
   * Public: List active gallery sections
   */
  getPublicSections: catchAsync(async (_req: Request, res: Response) => {
    const sections = await mediaCategoryService.getPublicSections();
    sendSuccess(res, { sections });
  }),

  /**
   * Admin: List all gallery sections
   */
  getAdminSections: catchAsync(async (_req: Request, res: Response) => {
    const sections = await mediaCategoryService.getAdminSections();
    sendSuccess(res, { sections });
  }),

  /**
   * Admin: Create new section
   */
  createSection: catchAsync(async (req: Request, res: Response) => {
    const adminUsername = (req as any).user?.username || (req as any).user?.name || 'admin';
    const section = await mediaCategoryService.createSection(req.body, adminUsername);
    sendSuccess(res, { section }, 201, 'Gallery section created successfully');
  }),

  /**
   * Admin: Update section
   */
  updateSection: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminUsername = (req as any).user?.username || (req as any).user?.name || 'admin';
    const section = await mediaCategoryService.updateSection(id, req.body, adminUsername);
    sendSuccess(res, { section }, 200, 'Gallery section updated successfully');
  }),

  /**
   * Admin: Delete section safely
   */
  deleteSection: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminUsername = (req as any).user?.username || (req as any).user?.name || 'admin';
    const result = await mediaCategoryService.deleteSection(id, adminUsername);
    sendSuccess(res, result, 200, result.message);
  }),
};

export default mediaCategoryController;
