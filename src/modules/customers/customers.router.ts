import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as customersController from './customers.controller.js';

const router = Router();

// Protect all customer routes
router.use(protect);

// 1. Analytics & Summary Stats
router.get('/stats/summary', restrictTo('SUPERADMIN', 'MANAGER'), customersController.getCustomerStats);

// 2. Customer Listing & Creation
router.get('/', restrictTo('SUPERADMIN', 'MANAGER'), customersController.getCustomers);
router.post('/', restrictTo('SUPERADMIN', 'MANAGER'), customersController.createCustomer);

// 3. Single Customer Operations
router.get('/:id', restrictTo('SUPERADMIN', 'MANAGER'), customersController.getCustomerById);
router.patch('/:id', restrictTo('SUPERADMIN', 'MANAGER'), customersController.updateCustomer);
router.put('/:id', restrictTo('SUPERADMIN', 'MANAGER'), customersController.updateCustomer);
router.delete('/:id', restrictTo('SUPERADMIN'), customersController.deleteCustomer);

export default router;
