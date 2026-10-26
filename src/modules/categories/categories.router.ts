import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as categoriesController from './categories.controller.js';

const router = Router();

// Public
router.get('/', categoriesController.getPublicCategories);

// Admin
router.get('/admin/all', protect, categoriesController.getAdminCategories);
router.post('/admin', protect, restrictTo('superadmin', 'manager'), categoriesController.createCategory);
router.put('/admin/:id', protect, restrictTo('superadmin', 'manager'), categoriesController.updateCategory);
router.delete('/admin/:id', protect, restrictTo('superadmin'), categoriesController.deleteCategory);

export default router;
