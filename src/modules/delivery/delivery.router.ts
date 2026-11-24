import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './delivery.controller.js';

const router = Router();

// 1. Public Endpoints
router.get('/serviceability', controller.checkServiceability);
router.post('/check', controller.checkServiceability);
router.get('/zones', controller.getDeliveryZones);
router.get('/status', controller.getStatus);
router.get('/track/:orderNumber', controller.getDeliveryByOrder);
router.get('/:orderNumber', controller.getDeliveryByOrder);

// 2. Staff / Dispatcher Protected Endpoints
router.get(
  '/stats',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getDeliveryStats
);

router.get(
  '/',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getAllDeliveries
);

router.post(
  '/:orderNumber/assign',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.assignRider
);

router.patch(
  '/:orderNumber/status',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.updateTrackingStatus
);

router.post(
  '/:orderNumber/verify-otp',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.verifyDeliveryOtp
);

// 3. Manager / Superadmin Zone Configuration
router.put(
  '/zones',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.updateDeliveryZones
);

export default router;
export const deliveryRouter = router;
