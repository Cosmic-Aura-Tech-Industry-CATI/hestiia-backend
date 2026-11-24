import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as dashboardController from './dashboard.controller.js';

const router = Router();

// Protect all dashboard routes
router.use(protect);

// Live Kitchen & Active Dining Orders (Floor & Kitchen Operations)
router.get('/live', restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER', 'STAFF'), dashboardController.getLiveOrders);

// Executive Overview & Sales Trends (Admin Only)
router.get('/', restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), dashboardController.getOverview);
router.get('/overview', restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), dashboardController.getOverview);
router.get('/stats', restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), dashboardController.getOverview);
router.get('/sales-trend', restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), dashboardController.getSalesTrend);
router.get('/popular-items', restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), dashboardController.getPopularItems);

export default router;
export const dashboardRouter = router;
