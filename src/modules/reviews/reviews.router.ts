import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as reviewsController from './reviews.controller.js';

const router = Router();

// Public
router.get('/', reviewsController.getPublicReviews);
router.post('/', reviewsController.submitReview);

// Admin
router.get('/admin/all', protect, reviewsController.getAdminReviews);
router.patch('/admin/:id/approve', protect, reviewsController.toggleApproval);
router.patch('/admin/:id/reply', protect, reviewsController.replyReview);
router.delete('/admin/:id', protect, restrictTo('superadmin', 'manager'), reviewsController.deleteReview);

export default router;
