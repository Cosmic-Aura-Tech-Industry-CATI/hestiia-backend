import { Router, Request, Response } from 'express';
import { protect, restrictTo } from '../../middleware/auth.middleware.js';
import { ordersService } from '../../modules/orders/orders.service.js';
import { tablesService } from '../../modules/tables/tables.service.js';
import adminStaffRouter from '../../modules/staff/staff.router.js';
import { catchAsync } from '../../shared/utils/index.js';
import { sendSuccess } from '../../shared/responses/index.js';

const router = Router();
router.use(protect);

router.get('/kitchen/orders', restrictTo('superadmin', 'manager', 'staff'), catchAsync(async (_req: Request, res: Response) => {
  const result = await ordersService.getAdminOrders({ orderStatus: 'preparing' });
  sendSuccess(res, result);
}));

router.patch('/kitchen/orders/:id/ready', restrictTo('superadmin', 'manager', 'staff'), catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const order = await ordersService.updateOrderStatus(id, 'ready_for_pickup', 'Marked ready by kitchen station');
  sendSuccess(res, { order });
}));

router.get('/tables', restrictTo('superadmin', 'manager', 'staff'), catchAsync(async (_req: Request, res: Response) => {
  const tables = await tablesService.getTables();
  sendSuccess(res, { tables });
}));

// Administrative staff management
router.use('/', adminStaffRouter);

export default router;
