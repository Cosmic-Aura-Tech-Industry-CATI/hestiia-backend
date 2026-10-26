import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as menuController from './menu.controller.js';

const router = Router();

// Public routes
router.get('/', menuController.getPublicMenu);

// Admin routes (Protected)
router.get('/admin/all', protect, menuController.getAdminDishes);
router.post('/admin', protect, restrictTo('superadmin', 'manager'), menuController.createDish);
router.put('/admin/:id', protect, restrictTo('superadmin', 'manager'), menuController.updateDish);
router.patch('/admin/:id/availability', protect, menuController.toggleAvailability);
router.delete('/admin/:id', protect, restrictTo('superadmin'), menuController.deleteDish);

// Single dish lookup (public or admin fallback)
router.get('/:id', menuController.getDishById);

export default router;
