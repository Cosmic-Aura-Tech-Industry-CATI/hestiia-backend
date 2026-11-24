
import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as menuController from './menu.controller.js';

const router = Router();

const managers = restrictTo('SUPERADMIN', 'MANAGER');
const superadmins = restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER');

// ==========================================
// 1. PUBLIC ROUTES
// ==========================================
router.get('/', menuController.getPublicMenu);

// ==========================================
// 2. ADMIN ROUTES
// ==========================================
router.get('/admin', protect, managers, menuController.getAdminDishes);
router.get('/admin/:id', protect, managers, menuController.getDishById);

// ==========================================
// 3. CREATE DISH
// ==========================================
router.post('/admin', protect, managers, menuController.createDish);

// ==========================================
// 4. TOGGLE AVAILABILITY
// ==========================================
router.patch('/admin/:id/availability', protect, managers, menuController.toggleAvailability);

// ==========================================
// 5. UPDATE DISH
// ==========================================
router.put('/admin/:id', protect, managers, menuController.updateDish);
router.patch('/admin/:id', protect, managers, menuController.updateDish);

// ==========================================
// 6. DELETE DISH
// ==========================================
router.delete('/admin/:id', protect, superadmins, menuController.deleteDish);

export default router;
