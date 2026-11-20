import { Router } from 'express';
import { protect } from '../../shared/middlewares/auth.middleware.js';
import * as ordersController from './orders.controller.js';

const router = Router();

// Public Order placement
router.post('/', ordersController.createOrder);

// Admin Order Management
router.get('/admin/all', protect, ordersController.getAdminOrders);
router.get('/admin/:id', protect, ordersController.getOrderDetails);
router.patch('/admin/:id/status', protect, ordersController.updateOrderStatus);
router.patch('/admin/:id/payment', protect, ordersController.updateOrderPayment);

export default router;
