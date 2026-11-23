import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as categoriesController from './categories.controller.js';

const router = Router();

// Public
router.get('/', categoriesController.getPublicCategories);
router.get('/public', categoriesController.getPublicCategories);

// Admin
router.get('/admin', protect, restrictTo('SUPERADMIN', 'MANAGER', 'superadmin', 'manager'), categoriesController.getAdminCategories);
router.get('/admin/all', protect, categoriesController.getAdminCategories);

router.get('/admin/:id', protect, restrictTo('SUPERADMIN', 'MANAGER', 'superadmin', 'manager'), categoriesController.getCategoryById);

router.post('/admin', protect, restrictTo('SUPERADMIN', 'MANAGER', 'superadmin', 'manager'), categoriesController.createCategory);

router.patch('/admin/:id', protect, restrictTo('SUPERADMIN', 'MANAGER', 'superadmin', 'manager'), categoriesController.updateCategory);
router.put('/admin/:id', protect, restrictTo('SUPERADMIN', 'MANAGER', 'superadmin', 'manager'), categoriesController.updateCategory);

router.delete('/admin/:id', protect, restrictTo('SUPERADMIN', 'superadmin'), categoriesController.deleteCategory);

export default router;
