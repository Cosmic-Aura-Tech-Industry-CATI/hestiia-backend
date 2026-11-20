import { Router } from 'express';
import { protect } from '../../shared/middlewares/auth.middleware.js';
import * as customersController from './customers.controller.js';

const router = Router();

router.use(protect);
router.get('/', customersController.getCustomers);
router.get('/:id', customersController.getCustomerById);

export default router;
