import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as ordersController from './orders.controller.js';

const router = Router();

// ==========================================
// 1. PUBLIC ROUTES
// ==========================================
// Public order placement
router.post('/', ordersController.createOrder);

// Public order tracking by order number
router.get('/track/:orderNumber', ordersController.trackOrder);

// ==========================================
// 2. ADMIN ORDER MANAGEMENT (SUPERADMIN & MANAGER)
// ==========================================
// List all orders (supports /api/orders/admin/all, /api/orders/admin, and /api/admin/orders)
router.get('/admin/all', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.getAdminOrders);
router.get('/admin', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.getAdminOrders);
router.get('/', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.getAdminOrders);

// Single order details
router.get('/admin/:id', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.getOrderDetails);
router.get('/:id', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.getOrderDetails);

// Status and payment updates
router.patch('/admin/:id/status', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.updateOrderStatus);
router.patch('/:id/status', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.updateOrderStatus);

router.patch('/admin/:id/payment', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.updateOrderPayment);
router.patch('/:id/payment', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.updateOrderPayment);

export default router;
