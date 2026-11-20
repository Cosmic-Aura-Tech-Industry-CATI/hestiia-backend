import { Router } from 'express';
import { protect } from '../../shared/middlewares/auth.middleware.js';
import * as partyController from './party.controller.js';

const router = Router();

// Public
router.post('/', partyController.createInquiry);

// Admin
router.get('/admin/all', protect, partyController.getAdminInquiries);
router.patch('/admin/:id/status', protect, partyController.updateInquiryStatus);

export default router;
