import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/utils/index.js';
import { sendSuccess } from '../../../shared/responses/index.js';
import { eventInquiryService } from '../services/eventInquiry.service.js';

export const eventInquiryController = {
  /**
   * Public: Submit event booking inquiry
   */
  createInquiry: catchAsync(async (req: Request, res: Response) => {
    const inquiry = await eventInquiryService.createInquiry(req.body);
    sendSuccess(res, { inquiry }, 201, 'Event inquiry submitted successfully');
  }),

  /**
   * Admin: List inquiries with filters & pagination
   */
  getAdminInquiries: catchAsync(async (req: Request, res: Response) => {
    const result = await eventInquiryService.getAdminInquiries(req.query);
    sendSuccess(res, result);
  }),

  /**
   * Admin: Get inquiry by ID
   */
  getAdminInquiryById: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const inquiry = await eventInquiryService.getAdminInquiryById(id);
    sendSuccess(res, { inquiry });
  }),

  /**
   * Admin: Update inquiry status & link to reservation if confirmed
   */
  updateStatus: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { status, extra } = req.body;
    const username = (req as any).user?.username || (req as any).user?.name || 'admin';
    const inquiry = await eventInquiryService.updateInquiryStatus(id, status, username, extra);
    sendSuccess(res, { inquiry }, 200, 'Inquiry status updated successfully');
  }),

  /**
   * Admin: Update staff/admin notes for inquiry
   */
  updateNotes: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { admin_notes } = req.body;
    const username = (req as any).user?.username || (req as any).user?.name || 'admin';
    const inquiry = await eventInquiryService.updateAdminNotes(id, admin_notes, username);
    sendSuccess(res, { inquiry }, 200, 'Staff notes updated successfully');
  }),
};

export default eventInquiryController;
