import { Router } from 'express';
import { protect } from '../../shared/middlewares/auth.middleware.js';
import * as reportsController from './reports.controller.js';

const router = Router();

router.use(protect);
router.get('/analytics', reportsController.getAnalytics);
router.get('/export/orders.csv', reportsController.exportOrdersCsv);
router.get('/export/customers.csv', reportsController.exportCustomersCsv);

export default router;
