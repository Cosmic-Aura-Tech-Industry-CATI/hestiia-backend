import { Router } from 'express';
import { protect, restrictTo } from '../../../middleware/auth.middleware.js';
import { eventInquiryController } from '../controllers/eventInquiry.controller.js';

// ==========================================
// 1. PUBLIC CUSTOMER EVENT INQUIRY ROUTES
// ==========================================
export const publicInquiryRouter = Router();

publicInquiryRouter.post('/', eventInquiryController.createInquiry);

// ==========================================
// 2. PROTECTED ADMIN EVENT INQUIRY ROUTES
// ==========================================
export const adminInquiryRouter = Router();

// Require authenticated Admin or Manager
adminInquiryRouter.use(protect);
adminInquiryRouter.use(restrictTo('SUPERADMIN', 'MANAGER', 'superadmin', 'manager'));

adminInquiryRouter.get('/', eventInquiryController.getAdminInquiries);
adminInquiryRouter.get('/:id', eventInquiryController.getAdminInquiryById);
adminInquiryRouter.patch('/:id/status', eventInquiryController.updateStatus);
adminInquiryRouter.patch('/:id/notes', eventInquiryController.updateNotes);

export default {
  publicInquiryRouter,
  adminInquiryRouter,
};
