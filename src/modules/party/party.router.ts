import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as partyController from './party.controller.js';

const router = Router();

const managers = restrictTo('SUPERADMIN', 'MANAGER');
const superadmins = restrictTo('SUPERADMIN');

// ==========================================
// 1. PUBLIC ROUTES
// ==========================================
router.post('/', partyController.createInquiry);

// ==========================================
// 2. ADMIN ROUTES
// ==========================================
router.get('/admin', protect, managers, partyController.getAdminInquiries);
router.get('/admin/:id', protect, managers, partyController.getInquiryById);

// ==========================================
// 3. UPDATE INQUIRY STATUS & FOLLOW-UP NOTES
// ==========================================
router.patch('/admin/:id/status', protect, managers, partyController.updateInquiryStatus);

// ==========================================
// 4. DELETE INQUIRY
// ==========================================
router.delete('/admin/:id', protect, superadmins, partyController.deleteInquiry);

export default router;
