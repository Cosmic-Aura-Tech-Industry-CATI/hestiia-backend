import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as promotionsController from './promotions.controller.js';

const router = Router();

// Public
router.get('/', promotionsController.getPublicPromotions);

// Admin
router.get('/admin/all', protect, promotionsController.getAdminPromotions);
router.post('/admin', protect, restrictTo('superadmin', 'manager'), promotionsController.createPromotion);
router.put('/admin/:id', protect, restrictTo('superadmin', 'manager'), promotionsController.updatePromotion);
router.delete('/admin/:id', protect, restrictTo('superadmin', 'manager'), promotionsController.deletePromotion);

export default router;
