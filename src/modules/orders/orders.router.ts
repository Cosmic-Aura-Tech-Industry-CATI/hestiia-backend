import { Router } from 'express';
import { protect } from '../../shared/middlewares/auth.middleware.js';
import * as ordersController from './orders.controller.js';

const router = Router();

// Public Order placement & Tracking
router.post('/', ordersController.createOrder);
router.get('/:id', ordersController.getOrderDetails);
router.post('/:id/cancel', ordersController.cancelOrder);

// Admin & Staff Order Management
router.get('/admin/all', protect, ordersController.getAdminOrders);
router.get('/admin/:id', protect, ordersController.getOrderDetails);
router.patch('/admin/:id/status', protect, ordersController.updateOrderStatus);
router.patch('/admin/:id/payment', protect, ordersController.updateOrderPayment);
router.post('/admin/:id/cancel', protect, ordersController.cancelOrder);

export default router;
