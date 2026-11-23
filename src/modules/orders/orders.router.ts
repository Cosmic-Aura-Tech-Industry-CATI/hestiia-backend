import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as ordersController from './orders.controller.js';

const router = Router();

// ==========================================
// 1. PUBLIC ORDER PLACEMENT & TRACKING
// ==========================================
router.post('/', ordersController.createOrder);
router.get('/track/:orderNumber', ordersController.trackOrder);

// ==========================================
// 2. ADMIN ORDER MANAGEMENT (STATIC ROUTES FIRST)
// ==========================================
// List all orders (supports /api/orders/admin/all, /api/orders/admin, and /api/admin/orders)
router.get('/admin/all', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.getAdminOrders);
router.get('/admin', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.getAdminOrders);

// Single order details & updates with /admin prefix
router.get('/admin/:id', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.getOrderDetails);
router.patch('/admin/:id/status', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.updateOrderStatus);
router.patch('/admin/:id/payment', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.updateOrderPayment);

// List orders when mounted under /api/v1/admin/orders
router.get('/', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.getAdminOrders);

// ==========================================
// 3. PARAMETERIZED ROUTES (PLACED AFTER ALL STATIC ROUTES)
// ==========================================
router.post('/:id/cancel', ordersController.cancelOrder);
router.patch('/:id/status', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.updateOrderStatus);
router.patch('/:id/payment', protect, restrictTo('SUPERADMIN', 'MANAGER'), ordersController.updateOrderPayment);
router.get('/:id', ordersController.getOrderDetails);

export default router;
