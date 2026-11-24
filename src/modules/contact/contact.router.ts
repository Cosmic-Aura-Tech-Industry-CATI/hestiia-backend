import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './contact.controller.js';
import { customerContactRouter, adminContactRouter } from './contact.routes.js';

const router = Router();

// Re-export modular contact routers
export { customerContactRouter, adminContactRouter };

// Public Contact Settings
router.get('/settings', controller.getCustomerContact);

// 1. Public Endpoints
router.post('/', controller.submitInquiry);
router.get('/status', controller.getStatus);

// 2. Protected Staff & Management Endpoints
router.get(
  '/stats',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getContactStats
);

router.get(
  '/admin/settings',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.getAdminSettings
);

router.put(
  '/admin/settings',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.updateAdminSettings
);

router.get(
  '/',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getInquiries
);

router.get(
  '/:id',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getInquiryById
);

router.patch(
  '/:id',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.updateInquiry
);

// 3. Superadmin Maintenance Endpoint
router.delete(
  '/:id',
  protect,
  restrictTo('SUPERADMIN'),
  controller.deleteInquiry
);

export default router;
export const contactRouter = router;
