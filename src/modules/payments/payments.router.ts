import { Router } from 'express';
import { protect } from '../../shared/middlewares/auth.middleware.js';
import * as paymentsController from './payments.controller.js';

const router = Router();

router.use(protect);
router.get('/', paymentsController.getPayments);
router.post('/record-collection', paymentsController.recordCollection);

export default router;
