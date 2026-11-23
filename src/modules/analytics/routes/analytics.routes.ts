import { Router } from 'express';
import { protect, restrictTo } from '../../../shared/middlewares/auth.middleware.js';
import * as analyticsController from '../controllers/analytics.controller.js';

const router = Router();

// Protect all analytics endpoints - Superadmin and Manager access only
router.use(protect);
router.use(restrictTo('SUPERADMIN', 'MANAGER', 'superadmin', 'manager'));

// All 6 Canonical Analytics Services
router.get('/overview', analyticsController.getOverview);
router.get('/revenue', analyticsController.getRevenue);
router.get('/orders', analyticsController.getOrders);
router.get('/products', analyticsController.getProducts);
router.get('/customers', analyticsController.getCustomers);
router.get('/payments', analyticsController.getPayments);

export default router;
