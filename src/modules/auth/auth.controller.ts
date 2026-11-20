import { Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { authService } from './auth.service.js';
import { db } from '../../shared/config/db.js';

export const login = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { username, password } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const { token, user } = await authService.login(username, password, ip);

  res.status(200).json({
    success: true,
    message: 'Welcome back to Hestiia Restaurant Administration.',
    token,
    user,
  });
});

export const getMe = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

export const logout = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  db.logAudit('ADMIN_LOGOUT', req.user?.username || 'admin', 'User logged out');
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

export const changePassword = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  res.status(200).json({ success: true, message: 'Password updated successfully.' });
});

export const getAllUsers = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const users = await authService.getAllUsers();
  res.status(200).json({ success: true, users });
});

export const createUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const user = await authService.createUser(req.body, req.user?.username || 'admin');
  res.status(201).json({ success: true, user, message: 'Staff user created successfully.' });
});
