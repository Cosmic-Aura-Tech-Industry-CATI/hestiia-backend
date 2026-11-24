import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import { contactController } from './contact.controller.js';

/**
 * Public Customer Contact Router
 * GET /api/customer/contact
 */
export const customerContactRouter = Router();
customerContactRouter.get('/', contactController.getCustomerContact);

/**
 * Protected Admin Contact Router
 * GET /api/admin/contact
 * PUT /api/admin/contact
 */
export const adminContactRouter = Router();
adminContactRouter.use(protect);
adminContactRouter.use(restrictTo('superadmin', 'manager'));

adminContactRouter.get('/', contactController.getAdminSettings);
adminContactRouter.put('/', contactController.updateAdminSettings);

export default {
  customerContactRouter,
  adminContactRouter,
};
