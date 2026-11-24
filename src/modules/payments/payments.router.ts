import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as paymentsController from './payments.controller.js';

const router = Router();

// Customer / Public Payment Endpoints
router.post('/intent', paymentsController.createPaymentIntent);
router.post('/verify', paymentsController.verifyOnlinePayment);
router.post('/manual-upi', paymentsController.submitManualUpi);

// Protected Admin & Staff Payment Operations
router.get('/', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), paymentsController.getPayments);
router.get('/reconciliation', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), paymentsController.getReconciliationReport);
router.post('/record-collection', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER', 'STAFF'), paymentsController.recordCollection);
router.post('/verify-upi', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER', 'STAFF'), paymentsController.verifyManualUpi);
router.post('/:id/refund', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), paymentsController.refundPayment);

export default router;
