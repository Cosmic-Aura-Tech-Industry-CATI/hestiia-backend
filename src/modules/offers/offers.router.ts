import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './offers.controller.js';

const router = Router();

// 1. Public Endpoints
router.get('/', controller.getPublicOffers);
router.get('/banners', controller.getBannerOffers);
router.post('/validate', controller.validateCoupon);
router.get('/status', controller.getStatus);
router.get('/:code', controller.getOfferByCode);

// 2. Staff / Admin Protected Endpoints
router.get(
  '/stats',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getOffersStats
);

router.get(
  '/admin/all',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getAdminOffers
);

router.post(
  '/',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.createOffer
);

router.patch(
  '/:id',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.updateOffer
);

router.delete(
  '/:id',
  protect,
  restrictTo('SUPERADMIN'),
  controller.deleteOffer
);

export default router;
export const offersRouter = router;
