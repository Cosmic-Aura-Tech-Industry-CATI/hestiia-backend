import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './staff.controller.js';

const router = Router();
router.use(protect);

// -------------------------------------------------------------
// 1. Kitchen Display System (KDS) & Stations
// -------------------------------------------------------------

router.get(
  '/kitchen/orders',
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF', 'CHEF'),
  controller.getKitchenOrders
);

router.patch(
  '/kitchen/orders/:id/ready',
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF', 'CHEF'),
  controller.markOrderReady
);

router.patch(
  '/kitchen/orders/:id/preparing',
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF', 'CHEF'),
  controller.markOrderPreparing
);

router.patch(
  '/kitchen/orders/:id/status',
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF', 'CHEF'),
  controller.updateKitchenOrderStatus
);

router.get(
  '/kitchen/stats',
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF', 'CHEF'),
  controller.getKitchenStats
);

// -------------------------------------------------------------
// 2. Dining Room Tables Coordination
// -------------------------------------------------------------

router.get(
  '/tables',
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getStaffTables
);

// -------------------------------------------------------------
// 3. Shift Attendance & Clock-In / Clock-Out
// -------------------------------------------------------------

router.post(
  '/shifts/clock-in',
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF', 'CHEF', 'DELIVERY'),
  controller.clockIn
);

router.post(
  '/shifts/clock-out',
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF', 'CHEF', 'DELIVERY'),
  controller.clockOut
);

router.post(
  '/shifts/:id/clock-out',
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF', 'CHEF', 'DELIVERY'),
  controller.clockOut
);

router.get(
  '/shifts/active',
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getActiveShifts
);

router.get(
  '/shifts',
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.getShifts
);

// -------------------------------------------------------------
// 4. Staff Member Directory (Roster Management)
// -------------------------------------------------------------

router.get(
  '/members',
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.getStaffMembers
);

router.get(
  '/members/:id',
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.getStaffMemberById
);

router.post(
  '/members',
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.createStaffMember
);

router.patch(
  '/members/:id',
  restrictTo('SUPERADMIN', 'MANAGER'),
  controller.updateStaffMember
);

router.delete(
  '/members/:id',
  restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'),
  controller.deleteStaffMember
);

// -------------------------------------------------------------
// 5. System Status
// -------------------------------------------------------------

router.get('/status', controller.getStatus);

export default router;
export const staffRouter = router;
