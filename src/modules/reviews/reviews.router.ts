import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as reviewsController from './reviews.controller.js';

const router = Router();

// Public
router.get('/', reviewsController.getPublicReviews);
router.post('/', reviewsController.submitReview);

// Admin
router.get('/admin/all', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), reviewsController.getAdminReviews);
router.patch('/admin/:id/approve', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), reviewsController.toggleApproval);
router.patch('/admin/:id/reply', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), reviewsController.replyReview);
router.delete('/admin/:id', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), reviewsController.deleteReview);

export default router;
