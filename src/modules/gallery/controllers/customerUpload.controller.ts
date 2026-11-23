import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/utils/index.js';
import { sendSuccess } from '../../../shared/responses/index.js';
import { AppError } from '../../../shared/utils/appError.js';
import { customerUploadService } from '../services/customerUpload.service.js';

export const customerUploadController = {
  /**
   * POST /api/v1/gallery/uploads
   * Guest customer photo submission
   */
  submitPhoto: catchAsync(async (req: Request, res: Response) => {
    const guestId = req.guestId;
    if (!guestId) {
      throw new AppError('Guest identity not initialized.', 401);
    }

    const file = req.file || (req.files && Array.isArray(req.files) ? req.files[0] : undefined);
    const { caption, sectionId } = req.body;

    const submission = await customerUploadService.submitCustomerPhoto(file as any, guestId, caption, sectionId);
    sendSuccess(res, { submission }, 201, 'Photograph submitted successfully for staff review');
  }),

  /**
   * GET /api/v1/gallery/my-uploads
   * List photos uploaded by the current guest session
   */
  getMyUploads: catchAsync(async (req: Request, res: Response) => {
    const guestId = req.guestId;
    if (!guestId) {
      throw new AppError('Guest identity not initialized.', 401);
    }

    const uploads = await customerUploadService.getMyUploads(guestId);
    sendSuccess(res, { uploads });
  }),

  /**
   * DELETE /api/v1/gallery/my-uploads/:id
   * Delete customer's own uploaded photo
   */
  deleteMyUpload: catchAsync(async (req: Request, res: Response) => {
    const guestId = req.guestId;
    if (!guestId) {
      throw new AppError('Guest identity not initialized.', 401);
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await customerUploadService.deleteMyUpload(guestId, id);
    sendSuccess(res, result, 200, result.message);
  }),
};

export default customerUploadController;
