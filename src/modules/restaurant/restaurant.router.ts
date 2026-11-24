import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './restaurant.controller.js';

const router = Router();

// 1. Public Endpoints (Diners & Online Storefront)
router.get('/', controller.getPublicProfile);
router.get('/info', controller.getPublicProfile);
router.get('/status', controller.getOperationalStatus);

// 2. Protected Endpoints (Staff, Managers, Superadmins)
router.get(
  '/admin',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getAdminDetails
);
router.get(
  '/details',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getAdminDetails
);

// Kitchen Rush Emergency Killswitch (Order Acceptance)
router.patch(
  '/orders-toggle',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.toggleOrderAcceptance
);
router.post(
  '/orders-toggle',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.toggleOrderAcceptance
);

// Table Booking Availability Killswitch
router.patch(
  '/reservations-toggle',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.toggleTableReservation
);
router.post(
  '/reservations-toggle',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.toggleTableReservation
);

// Full Restaurant Profile & Operating Hours Configuration (Superadmin & Manager)
router.patch(
  '/',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.updateRestaurant
);
router.put(
  '/',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.updateRestaurant
);

export default router;
export const restaurantRouter = router;
