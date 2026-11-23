import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as dashboardController from './dashboard.controller.js';

const router = Router();

// Protect all dashboard routes & restrict access to authorized staff / management
router.use(protect);
router.use(restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'));

// Executive Overview (accessible via / or /overview or /stats)
router.get('/', dashboardController.getOverview);
router.get('/overview', dashboardController.getOverview);
router.get('/stats', dashboardController.getOverview);

// Dynamic Sales Trend (?days=7, 14, 30)
router.get('/sales-trend', dashboardController.getSalesTrend);

// Top Selling Popular Dishes (?limit=10)
router.get('/popular-items', dashboardController.getPopularItems);

// Live Kitchen & Active Dining Orders
router.get('/live', dashboardController.getLiveOrders);

export default router;
export const dashboardRouter = router;
