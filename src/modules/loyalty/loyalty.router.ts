import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './loyalty.controller.js';

const router = Router();

// 1. Public & Customer Endpoints
router.get('/rewards', controller.getRewardsCatalog);
router.get('/status', controller.getStatus);
router.get('/profile', controller.getMyProfile);
router.get('/me', controller.getMyProfile);
router.post('/redeem', controller.redeemPoints);
router.post('/vouchers/redeem', controller.redeemVoucher);

// 2. Staff / Admin Protected Endpoints
router.get(
  '/stats',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getLoyaltyStats
);

router.get(
  '/customer/:idOrPhone',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getCustomerProfile
);

// 3. Superadmin / Manager Points Adjustment
router.post(
  '/adjust',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.manualAdjustment
);

export default router;
export const loyaltyRouter = router;
