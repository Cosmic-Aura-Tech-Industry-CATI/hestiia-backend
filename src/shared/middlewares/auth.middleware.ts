import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/utils.js';
import { db, AdminUser } from '../config/store.js';
import { AppError } from '../utils/appError.js';
import { catchAsync } from '../utils/catchAsync.js';

export interface AuthenticatedRequest extends Request {
  user?: Omit<AdminUser, 'passwordHash'>;
}

export const extractToken = (req: Request): string | undefined => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }
  if (req.cookies && req.cookies.admin_token) {
    return req.cookies.admin_token;
  }
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  return undefined;
};

export const protect = catchAsync(async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const token = extractToken(req);

  if (!token) {
    return next(new AppError('Authentication required. Please log in to the admin dashboard.', 401));
  }

  let decoded: { id: string; role: string; username: string };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string; username: string };
  } catch (err: any) {
    return next(new AppError('Invalid or expired session. Please log in again.', 401));
  }

  const user = db.getState().users.find((u) => u.id === decoded.id && u.active);
  if (!user) {
    return next(new AppError('Account not found or has been deactivated.', 401));
  }

  const { passwordHash, ...safeUser } = user;
  req.user = safeUser;
  next();
});

export const restrictTo = (...allowedRoles: Array<'superadmin' | 'manager' | 'staff'>) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: role '${req.user.role}' does not have permission to execute this operation.`,
          403
        )
      );
    }
    next();
  };
};

// Aliases for backward compatibility
export const authenticateAdmin = protect;
export const requireRole = (roles: Array<'superadmin' | 'manager' | 'staff'>) => restrictTo(...roles);
