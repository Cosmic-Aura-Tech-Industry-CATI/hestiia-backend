import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as invoicesController from './invoices.controller.js';

const router = Router();

router.use(protect);
router.use(restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'));
router.get('/', invoicesController.getInvoices);
router.get('/:identifier', invoicesController.getInvoiceDetails);

export default router;
