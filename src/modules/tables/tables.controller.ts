import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { sendSuccess, sendCreated } from '../../shared/responses/index.js';
import { tablesService } from './tables.service.js';
import type { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';

export const getTables = catchAsync(async (req: Request, res: Response) => {
  const tables = await tablesService.getTables(req.query as any);
  sendSuccess(res, { count: tables.length, tables });
});

export const getTableById = catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const table = await tablesService.getTableById(id);
  sendSuccess(res, { table });
});

export const createTable = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user?.name || req.user?.username || 'Superadmin';
  const table = await tablesService.createTable(req.body, actor);
  sendCreated(res, { table }, 'Dining table created successfully');
});

export const updateTable = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actor = req.user?.name || req.user?.username || 'Superadmin';
  const table = await tablesService.updateTable(id, req.body, actor);
  sendSuccess(res, { table }, 200, 'Table specifications updated successfully');
});

export const updateTableStatus = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actor = req.user?.name || req.user?.username || 'Staff';
  const { status } = req.body || {};
  const table = await tablesService.updateStatus(id, status, actor);
  sendSuccess(res, { table }, 200, `Table status updated to "${status}"`);
});

export const deleteTable = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const actor = req.user?.name || req.user?.username || 'Superadmin';
  const table = await tablesService.deleteTable(id, actor);
  sendSuccess(res, { table }, 200, 'Table deactivated successfully');
});

export const getStats = catchAsync(async (_req: Request, res: Response) => {
  const stats = await tablesService.getTableStats();
  sendSuccess(res, stats);
});

export const getZones = catchAsync(async (_req: Request, res: Response) => {
  const zones = await tablesService.getZones();
  sendSuccess(res, { count: zones.length, zones });
});
