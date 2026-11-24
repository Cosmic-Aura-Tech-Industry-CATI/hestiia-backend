import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { usersService } from './users.service.js';
import { sendSuccess } from '../../shared/responses/index.js';

export const getUsers = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await usersService.getUsers(req.query as any);
  res.status(200).json(result);
});

export const getUserById = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = await usersService.getUserById(id);
  res.status(200).json({ success: true, user });
});

export const createUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const user = await usersService.createUser(req.body, req.user!);
  res.status(201).json({
    success: true,
    message: 'Staff/Administrative user account created successfully.',
    user,
  });
});

export const updateUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = await usersService.updateUser(id, req.body, req.user!);
  res.status(200).json({
    success: true,
    message: 'User details updated successfully.',
    user,
  });
});

export const updateUserRole = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = await usersService.updateUserRole(id, req.body.role, req.user!);
  res.status(200).json({
    success: true,
    message: `User role changed to '${req.body.role}' successfully.`,
    user,
  });
});

export const updateUserStatus = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = await usersService.updateUserStatus(id, req.body.status, req.user!);
  res.status(200).json({
    success: true,
    message: `User account status changed to '${req.body.status}' successfully.`,
    user,
  });
});

export const deleteUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await usersService.deleteUser(id, req.user!);
  res.status(200).json(result);
});

export const getStatus = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const status = await usersService.getStatus();
  sendSuccess(res, status);
});
