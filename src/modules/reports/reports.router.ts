import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as reportsController from './reports.controller.js';

const router = Router();

// Protect all reports & restrict access to Management (Superadmin & Manager)
router.use(protect);
router.use(restrictTo('SUPERADMIN', 'MANAGER'));

// Analytics & Tax Summaries
router.get('/analytics', reportsController.getAnalytics);
router.get('/tax', reportsController.getTaxReport);
router.get('/status', reportsController.getStatus);

// CSV File Exports
router.get('/export/orders.csv', reportsController.exportOrdersCsv);
router.get('/export/customers.csv', reportsController.exportCustomersCsv);
router.get('/export/tax.csv', reportsController.exportTaxCsv);
router.get('/export/menu-performance.csv', reportsController.exportMenuPerformanceCsv);

export default router;
export const reportsRouter = router;
