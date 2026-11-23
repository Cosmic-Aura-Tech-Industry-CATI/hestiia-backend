import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './pricing.controller.js';

const router = Router();

// 1. Public Endpoints
router.post('/calculate', controller.calculateBillQuote);
router.post('/quote', controller.calculateBillQuote);
router.get('/rules', controller.getPublicPricingRules);
router.get('/tax-estimate', controller.getTaxEstimate);
router.get('/status', controller.getStatus);

// 2. Staff / Admin Protected Endpoints
router.get(
  '/admin/rules',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getAdminPricingRules
);

router.post(
  '/rules',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.createPricingRule
);

router.patch(
  '/rules/:id',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.updatePricingRule
);

router.delete(
  '/rules/:id',
  protect,
  restrictTo('SUPERADMIN'),
  controller.deletePricingRule
);

export default router;
export const pricingRouter = router;
