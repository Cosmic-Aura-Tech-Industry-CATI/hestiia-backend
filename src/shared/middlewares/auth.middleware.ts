import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import {
  JWT_ACCESS_SECRET,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN,
  COOKIE_SECURE,
  COOKIE_SAME_SITE,
} from '../config/utils.js';
import { db } from '../config/store.js';
import { AppError } from '../utils/appError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { userRepository } from '../../modules/users/user.repository.js';
import { UserRole, UserStatus } from '../../modules/users/user.interface.js';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: UserRole;
  status: UserStatus;
  tokenVersion?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Extract JWT token from Authorization header or signed/unsigned cookies
 */
export const extractToken = (req: Request): string | undefined => {
  if (req.headers.authorization) {
    const match = req.headers.authorization.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1].trim();
    }
  }
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  if (req.cookies?.admin_token) {
    return req.cookies.admin_token;
  }
  return undefined;
};

/**
 * Centralized Authentication Middleware
 * Validates JWT, verifies tokenVersion, loads user, rejects inactive accounts.
 */
export const requireAuth = catchAsync(
  async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    // If request was already authenticated by parent router, skip redundant verification
    if (req.user) {
      return next();
    }

    const token = extractToken(req);

    if (!token) {
      return next(new AppError('Authentication required. Please provide a valid authorization token.', 401));
    }

    let decoded: { id: string; role: string; email?: string; username?: string; tokenVersion?: number };
    try {
      decoded = jwt.verify(token, JWT_ACCESS_SECRET) as any;
    } catch (err: any) {
      // Fallback try with generic JWT_SECRET if access secret differed
      try {
        decoded = jwt.verify(token, JWT_SECRET) as any;
      } catch {
        return next(new AppError('Invalid or expired authentication session. Please sign in again.', 401));
      }
    }

    // 1. Fetch user from MongoDB Atlas
    let dbUser = null;
    if (mongoose.connection.readyState === 1 && decoded.id) {
      try {
        dbUser = await userRepository.findById(decoded.id);
        if (!dbUser && decoded.email) {
          dbUser = await userRepository.findByEmail(decoded.email);
        }
      } catch {
        dbUser = null;
      }
    }

    // Fallback sync with in-memory store if DB lookup returned null
    let matchedUser: AuthenticatedUser | undefined;

    if (dbUser) {
      matchedUser = {
        id: String(dbUser._id),
        name: dbUser.name,
        email: dbUser.email,
        username: dbUser.username,
        role: dbUser.role,
        status: dbUser.status,
        tokenVersion: dbUser.tokenVersion,
      };
    } else {
      const storeUser = db.getState().users.find(
        (u) =>
          u.id === decoded.id ||
          (decoded.email && u.email.toLowerCase() === decoded.email.toLowerCase()) ||
          (decoded.username && u.username.toLowerCase() === decoded.username.toLowerCase())
      );
      if (storeUser) {
        const uRole = (storeUser.role || '').toUpperCase();
        matchedUser = {
          id: storeUser.id,
          name: storeUser.name,
          email: storeUser.email,
          username: storeUser.username,
          role: uRole as UserRole,
          status: storeUser.active ? 'ACTIVE' : 'INACTIVE',
          tokenVersion: storeUser.tokenVersion || 0,
        };
      } else if (decoded.role && decoded.role.toLowerCase() === 'customer') {
        matchedUser = {
          id: decoded.id || 'cust_user',
          name: 'Customer',
          email: decoded.email || 'customer@hestiia.com',
          role: 'CUSTOMER',
          status: 'ACTIVE',
          tokenVersion: 0,
        };
      }
    }

    if (!matchedUser) {
      return next(new AppError('Account not found or has been removed.', 401));
    }

    // 2. Reject inactive accounts
    if (matchedUser.status === 'INACTIVE') {
      return next(new AppError('Your account has been deactivated. Please contact the Superadmin.', 401));
    }

    // 3. Reject revoked tokens (password change or logout increments tokenVersion)
    const currentTokenVersion = matchedUser.tokenVersion || 0;
    if (typeof decoded.tokenVersion === 'number' && decoded.tokenVersion < currentTokenVersion) {
      return next(new AppError('Session has been revoked or invalidated. Please sign in again.', 401));
    }

    req.user = matchedUser;
    next();
  }
);

/**
 * Role Authorization Middleware
 * Usage: requireRole('SUPERADMIN'), requireRole('SUPERADMIN', 'MANAGER')
 *
 * Rules:
 * - SUPERADMIN can access all protected operations.
 * - MANAGER can access only authorized operational endpoints.
 * - MANAGER receives HTTP 403 when accessing Superadmin-only APIs.
 * - Never trusts roles from request body or query parameters.
 */
export const requireRole = (...allowedRoles: Array<UserRole | string>) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    const userRole = (req.user.role || '').toUpperCase() as UserRole;
    const isSuperAdmin = userRole === 'SUPERADMIN' || (userRole as string) === 'ADMIN';

    // 1. SUPERADMIN has full access to all protected operations
    if (isSuperAdmin) {
      return next();
    }

    // Normalize allowed roles
    const normalizedAllowed = allowedRoles.map((r) => {
      const upper = r.toUpperCase();
      return upper === 'ADMIN' ? 'SUPERADMIN' : upper;
    });

    // 2. MANAGER is permitted only when 'MANAGER' is in allowed roles
    if (userRole === 'MANAGER' && normalizedAllowed.includes('MANAGER')) {
      return next();
    }

    // 3. STAFF is permitted only when 'STAFF' is in allowed roles
    if (userRole === 'STAFF' && normalizedAllowed.includes('STAFF')) {
      return next();
    }

    // 4. Unauthorized role receives 403
    return next(
      new AppError(
        `Forbidden: Role '${req.user.role}' does not have sufficient permissions to execute this operation.`,
        403
      )
    );
  };
};

/**
 * Sets secure HttpOnly cookies for web dashboard clients
 */
export const setAuthCookies = (res: Response, accessToken: string, refreshToken?: string): void => {
  const isProduction = COOKIE_SECURE;
  const sameSite = COOKIE_SAME_SITE;

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('admin_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
};

/**
 * Clears authentication cookies upon logout
 */
export const clearAuthCookies = (res: Response): void => {
  const isProduction = COOKIE_SECURE;
  const sameSite = COOKIE_SAME_SITE;

  res.clearCookie('accessToken', { httpOnly: true, secure: isProduction, sameSite, path: '/' });
  res.clearCookie('admin_token', { httpOnly: true, secure: isProduction, sameSite, path: '/' });
  res.clearCookie('refreshToken', { httpOnly: true, secure: isProduction, sameSite, path: '/' });
};

// Aliases for backward compatibility across modules
export const protect = requireAuth;
export const authenticateAdmin = requireAuth;
export const restrictTo = requireRole;
