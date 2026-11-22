import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as categoriesController from './categories.controller.js';

const router = Router();

// Public
router.get('/public', categoriesController.getPublicCategories);

// Admin
router.get('/admin', protect, restrictTo('SUPERADMIN', 'MANAGER'), categoriesController.getAdminCategories);

router.get('/admin/:id', protect, restrictTo('SUPERADMIN', 'MANAGER'), categoriesController.getCategoryById);

router.post('/admin', protect, restrictTo('SUPERADMIN', 'MANAGER'), categoriesController.createCategory);

router.patch('/admin/:id', protect, restrictTo('SUPERADMIN', 'MANAGER'), categoriesController.updateCategory);

router.delete('/admin/:id', protect, restrictTo('SUPERADMIN'), categoriesController.deleteCategory);

export default router;
