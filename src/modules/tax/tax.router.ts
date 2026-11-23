import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './tax.controller.js';

const router = Router();

// -------------------------------------------------------------
// 1. Public Tax Calculation & Estimates
// -------------------------------------------------------------

router.post('/calculate', controller.calculateTax);
router.get('/estimate', controller.getEstimate);
router.get('/config', controller.getConfig);
router.get('/status', controller.getStatus);

// -------------------------------------------------------------
// 2. Protected Tax Reporting (GSTR-3B) & Rate Administration
// -------------------------------------------------------------

router.get(
  '/gstr3b',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.getGstr3bSummary
);

router.patch(
  '/config',
  protect,
  restrictTo('SUPERADMIN'),
  controller.updateConfig
);

router.put(
  '/config',
  protect,
  restrictTo('SUPERADMIN'),
  controller.updateConfig
);

export default router;
export const taxRouter = router;
