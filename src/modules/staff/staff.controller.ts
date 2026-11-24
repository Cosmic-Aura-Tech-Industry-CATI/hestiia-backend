import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { sendSuccess, sendCreated } from '../../shared/responses/index.js';
import { staffService } from './staff.service.js';
import type { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';

// -------------------------------------------------------------
// 1. Staff Members Directory
// -------------------------------------------------------------

export const getStaffMembers = catchAsync(async (req: Request, res: Response) => {
  const members = await staffService.getStaffMembers(req.query as any);
  sendSuccess(res, { count: members.length, members });
});

export const getStaffMemberById = catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const member = await staffService.getStaffMemberById(id);
  sendSuccess(res, { member });
});

export const createStaffMember = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user?.name || req.user?.username || 'Superadmin';
  const member = await staffService.createStaffMember(req.body, actor);
  sendCreated(res, { member }, 'Staff member created successfully');
});

export const updateStaffMember = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actor = req.user?.name || req.user?.username || 'Superadmin';
  const member = await staffService.updateStaffMember(id, req.body, actor);
  sendSuccess(res, { member }, 200, 'Staff member updated successfully');
});

export const deleteStaffMember = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actor = req.user?.name || req.user?.username || 'Superadmin';
  const member = await staffService.deleteStaffMember(id, actor);
  sendSuccess(res, { member }, 200, 'Staff member status set to terminated');
});

// -------------------------------------------------------------
// 2. Staff Shifts & Attendance
// -------------------------------------------------------------

export const clockIn = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user?.name || req.user?.username || 'Staff';
  const shift = await staffService.clockIn(req.body, actor);
  sendCreated(res, { shift }, 'Shift started successfully (Clocked In)');
});

export const clockOut = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actor = req.user?.name || req.user?.username || 'Staff';
  const shift = await staffService.clockOut(id, req.body, actor);
  sendSuccess(res, { shift }, 200, 'Shift completed successfully (Clocked Out)');
});

export const getActiveShifts = catchAsync(async (req: Request, res: Response) => {
  const branchId = (req.query.branchId as string) || 'branch_shyam_nagar';
  const shifts = await staffService.getActiveShifts(branchId);
  sendSuccess(res, { count: shifts.length, shifts });
});

export const getShifts = catchAsync(async (req: Request, res: Response) => {
  const result = await staffService.getShifts(req.query as any);
  sendSuccess(res, result);
});

// -------------------------------------------------------------
// 3. Kitchen Display System (KDS) & Orders
// -------------------------------------------------------------

export const getKitchenOrders = catchAsync(async (req: Request, res: Response) => {
  const result = await staffService.getKitchenOrders(req.query as any);
  sendSuccess(res, result);
});

export const updateKitchenOrderStatus = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actor = req.user?.name || req.user?.username || 'Kitchen Station';
  const { status, note } = req.body || {};
  const order = await staffService.updateKitchenOrderStatus(id, status, note, actor);
  sendSuccess(res, { order }, 200, `Order status updated to ${status}`);
});

export const markOrderPreparing = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actor = req.user?.name || req.user?.username || 'Chef';
  const order = await staffService.markOrderPreparing(id, req.body?.note, actor);
  sendSuccess(res, { order }, 200, 'Order marked preparing (cooking in progress)');
});

export const markOrderReady = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actor = req.user?.name || req.user?.username || 'Kitchen Station';
  const order = await staffService.markOrderReady(id, req.body?.note, actor);
  sendSuccess(res, { order }, 200, 'Order marked ready for pickup');
});

export const getKitchenStats = catchAsync(async (_req: Request, res: Response) => {
  const stats = await staffService.getKitchenStats();
  sendSuccess(res, stats);
});

// -------------------------------------------------------------
// 4. Tables & Status
// -------------------------------------------------------------

export const getStaffTables = catchAsync(async (_req: Request, res: Response) => {
  const tables = await staffService.getStaffTables();
  sendSuccess(res, { tables });
});

export const getStatus = catchAsync(async (_req: Request, res: Response) => {
  const status = await staffService.getStatus();
  sendSuccess(res, status);
});
