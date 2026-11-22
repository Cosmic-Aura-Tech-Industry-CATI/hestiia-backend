import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as paymentsController from './payments.controller.js';

const router = Router();

// Customer / Public Payment Endpoints
router.post('/intent', paymentsController.createPaymentIntent);
router.post('/verify', paymentsController.verifyOnlinePayment);
router.post('/manual-upi', paymentsController.submitManualUpi);

// Protected Admin & Staff Payment Operations
router.get('/', protect, paymentsController.getPayments);
router.get('/reconciliation', protect, paymentsController.getReconciliationReport);
router.post('/record-collection', protect, paymentsController.recordCollection);
router.post('/verify-upi', protect, paymentsController.verifyManualUpi);
router.post('/:id/refund', protect, restrictTo('superadmin', 'manager'), paymentsController.refundPayment);

export default router;
