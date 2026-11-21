import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { db, AdminUser } from '../shared/config/store.js';
import { UnauthorizedError, ForbiddenError } from '../shared/errors/index.js';
import { catchAsync } from '../shared/utils/index.js';

export interface AuthenticatedRequest extends Request {
  user?: Omit<AdminUser, 'passwordHash'>;
}

export const extractToken = (req: Request): string | undefined => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }
  if (req.cookies && (req.cookies.admin_token || req.cookies.accessToken)) {
    return req.cookies.admin_token || req.cookies.accessToken;
  }
  return undefined;
};

export const protect = catchAsync(async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return next(new UnauthorizedError('Authentication required to access this resource.'));
  }

  let decoded: { id: string; role: string; username: string };
  try {
    decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
  } catch (err) {
    return next(new UnauthorizedError('Invalid or expired session. Please log in again.'));
  }

  const user = db.getState().users.find((u) => u.id === decoded.id && u.active);
  if (!user) {
    return next(new UnauthorizedError('User account not found or has been disabled.'));
  }

  const { passwordHash, ...safeUser } = user;
  req.user = safeUser;
  next();
});

export const restrictTo = (...roles: Array<'superadmin' | 'manager' | 'staff'>) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Forbidden: role '${req.user?.role}' does not have permission.`));
    }
    next();
  };
};

export const authenticateAdmin = protect;
export const requireRole = restrictTo;
