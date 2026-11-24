import { Router, Request, Response } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import { ordersService } from '../../modules/orders/orders.service.js';
import { tablesService } from '../../modules/tables/tables.service.js';
import adminStaffRouter from '../../modules/staff/staff.router.js';
import { staffRouter as staffOperationsRouter } from '../../modules/staff/index.js';
import * as authController from '../../modules/auth/auth.controller.js';
import { catchAsync } from '../../shared/utils/index.js';
import { sendSuccess } from '../../shared/responses/index.js';

const router = Router();

// ==========================================
// 1. PUBLIC STAFF AUTHENTICATION (STAFF LOGIN)
// ==========================================
router.post('/auth/login', authController.staffLogin);
router.post('/login', authController.staffLogin);
router.post('/auth/refresh', authController.refresh);
router.post('/refresh', authController.refresh);

// ==========================================
// 2. AUTHENTICATED STAFF SESSION
// ==========================================
router.post('/auth/logout', protect, authController.logout);
router.post('/logout', protect, authController.logout);
router.get('/auth/me', protect, authController.getMe);
router.get('/me', protect, authController.getMe);

// ==========================================
// 3. DIRECT KITCHEN & TABLE HANDLERS
// ==========================================
router.get('/kitchen/orders', protect, restrictTo('superadmin', 'manager', 'staff'), catchAsync(async (_req: Request, res: Response) => {
  const result = await ordersService.getAdminOrders({ orderStatus: 'preparing' });
  sendSuccess(res, result);
}));

router.patch('/kitchen/orders/:id/ready', protect, restrictTo('superadmin', 'manager', 'staff'), catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const order = await ordersService.updateOrderStatus(id, 'ready_for_pickup', 'Marked ready by kitchen station');
  sendSuccess(res, { order });
}));

router.get('/tables', protect, restrictTo('superadmin', 'manager', 'staff'), catchAsync(async (_req: Request, res: Response) => {
  const tables = await tablesService.getTables();
  sendSuccess(res, { tables });
}));

// ==========================================
// 4. STAFF OPERATIONS (KDS, Shifts, Dining Floor)
// ==========================================
router.use('/', staffOperationsRouter);

// ==========================================
// 5. ADMINISTRATIVE STAFF MANAGEMENT
// ==========================================
router.use('/', adminStaffRouter);

export default router;
export { router as staffRouter };
