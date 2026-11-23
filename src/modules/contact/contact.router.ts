import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './contact.controller.js';

const router = Router();

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
