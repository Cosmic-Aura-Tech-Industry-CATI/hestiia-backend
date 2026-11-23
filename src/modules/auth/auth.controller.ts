import { Response } from 'express';
import { AppError } from '../../shared/utils/appError.js';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import {
  AuthenticatedRequest,
  setAuthCookies,
  clearAuthCookies,
} from '../../shared/middlewares/auth.middleware.js';
import { authService as defaultAuthService } from './auth.service.js';

/**
 * ============================================================================
 * AUTHENTICATION CONTROLLER HANDLERS
 * Production-ready Express handlers for Hestiia Restaurant Authentication & RBAC
 * ============================================================================
 */

/**
 * Step 1: Login with credentials (email/username + password)
 * Authenticates credentials and creates an access session
 */
export const login = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { email, username, identifier, password } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const userIdentifier = email || username || identifier;
  const result = await defaultAuthService.login(userIdentifier, password, ip);

  setAuthCookies(res, result.accessToken, result.refreshToken);

  res.status(200).json(result);
});

/**
 * Step 2: Verify Login OTP
 * Validates OTP code, signs JWT tokens (access + refresh), sets secure cookies
 */
export const verifyOtp = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { email, otpSessionId, otp } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const result = await defaultAuthService.verifyLoginOtp(email || otpSessionId, otp, ip);

  // Set secure HttpOnly cookies for web dashboard clients
  setAuthCookies(res, result.accessToken, result.refreshToken);

  res.status(200).json(result);
});

// Alias for compatibility
export const verifyLogin = verifyOtp;

/**
 * Resend OTP code for active login or password recovery session
 */
export const resendOtp = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { email, username, otpSessionId } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const result = await defaultAuthService.resendOtp(email || username || otpSessionId, ip);

  res.status(200).json(result);
});

/**
 * Refresh Access Token using Refresh Token with token rotation
 */
export const refresh = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  // Safely extract token from HttpOnly cookies or request body using optional chaining
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (!token) {
    throw new AppError('Refresh token is required. Please provide it via cookies or request body.', 401);
  }

  const result = await defaultAuthService.refreshTokens(token, ip);
  setAuthCookies(res, result.accessToken, result.refreshToken);

  res.status(200).json(result);
});

// Aliases for compatibility
export const refreshToken = refresh;
export const refreshAccessToken = refresh;

/**
 * Logout authenticated user: Invalidate session and clear cookies
 */
export const logout = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (req.user?.id) {
    await defaultAuthService.logout(req.user.id, req.user.email, ip);
  }

  clearAuthCookies(res);
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

/**
 * Get current authenticated user profile
 */
export const getMe = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

/**
 * Step 1 of Password Reset: Request password reset OTP
 */
export const forgotPassword = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { email, username, emailOrUsername } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const result = await defaultAuthService.forgotPassword(email || username || emailOrUsername, ip);
  res.status(200).json(result);
});

// Alias for compatibility
export const forgetPassword = forgotPassword;

/**
 * Step 2 of Password Reset: Verify OTP and update password
 */
export const resetPassword = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { email, otp, newPassword } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const result = await defaultAuthService.resetPassword(email, otp, newPassword, ip);
  res.status(200).json(result);
});

/**
 * ============================================================================
 * USER MANAGEMENT CONTROLLER HANDLERS (SUPERADMIN ONLY)
 * ============================================================================
 */

/**
 * Create new user account (SUPERADMIN or MANAGER)
 */
export const createUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const user = await defaultAuthService.createUser(req.body, req.user!);
  res.status(201).json({
    success: true,
    message: 'User account created successfully.',
    user,
  });
});

// Alias for compatibility
export const createNewUser = createUser;

/**
 * List all users with pagination and filtering
 */
export const getUsers = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await defaultAuthService.getUsers(req.query as any);
  res.status(200).json(result);
});

/**
 * Get single user details by ID
 */
export const getUserById = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const user = await defaultAuthService.getUserById(req.params.id as string);
  res.status(200).json({
    success: true,
    user,
  });
});

/**
 * Update user basic details (name, email)
 */
export const updateUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const user = await defaultAuthService.updateUser(req.params.id as string, req.body, req.user!);
  res.status(200).json({
    success: true,
    message: 'User updated successfully.',
    user,
  });
});

/**
 * Update user role (SUPERADMIN or MANAGER)
 */
export const updateUserRole = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const user = await defaultAuthService.updateUserRole(req.params.id as string, req.body.role, req.user!);
  res.status(200).json({
    success: true,
    message: `User role updated successfully to '${user.role}'.`,
    user,
  });
});

/**
 * Update user account status (ACTIVE or INACTIVE)
 */
export const updateUserStatus = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const user = await defaultAuthService.updateUserStatus(req.params.id as string, req.body.status, req.user!);
  res.status(200).json({
    success: true,
    message: `User status updated successfully to '${user.status}'.`,
    user,
  });
});

/**
 * Delete user account
 */
export const deleteUser = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await defaultAuthService.deleteUser(req.params.id as string, req.user!);
  res.status(200).json(result);
});

/**
 * Dedicated Superadmin Creation Endpoint
 * Accepts strictly: { name, email, password }
 */
export const createSuperAdmin = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, password } = req.body;

  const user = await defaultAuthService.createSuperAdmin({ name, email, password });

  res.status(201).json({
    success: true,
    message: 'Superadmin account created successfully.',
    user,
  });
});

/**
 * Class-based AuthController for OOP / DI architectures
 */
export class AuthController {
  constructor(private readonly service = defaultAuthService) {}

  public login = login;
  public verifyLogin = verifyOtp;
  public verifyOtp = verifyOtp;
  public resendOtp = resendOtp;
  public refreshAccessToken = refresh;
  public refresh = refresh;
  public logout = logout;
  public getMe = getMe;
  public forgetPassword = forgotPassword;
  public forgotPassword = forgotPassword;
  public resetPassword = resetPassword;
  public createNewUser = createUser;
  public createUser = createUser;
  public getUsers = getUsers;
  public getUserById = getUserById;
  public updateUser = updateUser;
  public updateUserRole = updateUserRole;
  public updateUserStatus = updateUserStatus;
  public deleteUser = deleteUser;
  public createSuperAdmin = createSuperAdmin;
}

export default {
  login,
  verifyOtp,
  verifyLogin,
  resendOtp,
  refresh,
  refreshAccessToken,
  logout,
  getMe,
  forgotPassword,
  forgetPassword,
  resetPassword,
  createUser,
  createNewUser,
  getUsers,
  getUserById,
  updateUser,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  createSuperAdmin,
  AuthController,
};
