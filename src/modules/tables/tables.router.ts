import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './tables.controller.js';

const router = Router();

// -------------------------------------------------------------
// 1. Public & Floor Browsing Endpoints
// -------------------------------------------------------------

router.get('/', controller.getTables);
router.get('/zones', controller.getZones);
router.get('/stats', controller.getStats);
router.get('/:id', controller.getTableById);

// -------------------------------------------------------------
// 2. Staff Seating & Status Transitions
// -------------------------------------------------------------

router.patch(
  '/:id/status',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF', 'CHEF'),
  controller.updateTableStatus
);

// -------------------------------------------------------------
// 3. Admin Table Asset Management
// -------------------------------------------------------------

router.post(
  '/',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.createTable
);

router.patch(
  '/:id',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.updateTable
);

router.put(
  '/:id',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.updateTable
);

router.delete(
  '/:id',
  protect,
  restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'),
  controller.deleteTable
);

export default router;
export const tablesRouter = router;
