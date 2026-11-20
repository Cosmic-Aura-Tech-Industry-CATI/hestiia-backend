import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { JWT_SECRET } from './env';
import { AppError } from './errors';
import { connectDB } from './mongodb';
import { IAdminUser, UserModel } from '@/models/User.model';
import { LoginAttemptModel } from '@/models/LoginAttempt.model';
import { cleanDoc } from '@/models/_schema';

export type SafeAdminUser = Omit<IAdminUser, 'passwordHash'>;

/**
 * Extract client IP address from proxy/request headers.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Extract JWT token from Authorization Bearer header or auth cookies.
 */
export function extractToken(req: NextRequest): string | undefined {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const adminToken = req.cookies.get('admin_token')?.value;
  if (adminToken) return adminToken;

  const accessToken = req.cookies.get('accessToken')?.value;
  if (accessToken) return accessToken;

  return undefined;
}

/**
 * Verify JWT, confirm active user in MongoDB, and validate tokenVersion.
 */
export async function requireAuth(req: NextRequest): Promise<SafeAdminUser> {
  const token = extractToken(req);
  if (!token) {
    throw new AppError(
      'Authentication required. Please log in to the admin dashboard.',
      401
    );
  }

  let decoded: { id: string; role: string; username: string; tokenVersion?: number };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: string;
      username: string;
      tokenVersion?: number;
    };
  } catch {
    throw new AppError('Invalid or expired session. Please log in again.', 401);
  }

  await connectDB();
  const userDoc = await UserModel.findOne({ id: decoded.id, active: true }).lean();
  if (!userDoc) {
    throw new AppError('Account not found or has been deactivated.', 401);
  }

  if ((decoded.tokenVersion ?? 0) !== (userDoc.tokenVersion ?? 0)) {
    throw new AppError(
      'Session has been invalidated or logged out. Please log in again.',
      401
    );
  }

  const clean = cleanDoc<IAdminUser>(userDoc);
  const { passwordHash: _removed, ...safeUser } = clean;
  return safeUser;
}

/**
 * Enforce role-based access control for an authenticated user.
 */
export function requireRole(
  user: SafeAdminUser,
  ...allowedRoles: Array<'superadmin' | 'manager' | 'staff'>
): void {
  if (!allowedRoles.includes(user.role)) {
    throw new AppError(
      `Forbidden: role '${user.role}' does not have permission to execute this operation.`,
      403
    );
  }
}

/**
 * MongoDB-backed sliding/window IP rate limiter for sensitive auth endpoints.
 */
export async function enforceAuthRateLimit(
  ip: string,
  bucket: string,
  maxRequests = 20,
  windowMs = 15 * 60 * 1000
): Promise<void> {
  await connectDB();
  const key = `ratelimit:${bucket}:${ip}`;
  const now = Date.now();
  const existing = await LoginAttemptModel.findOne({ key }).lean();

  if (existing && existing.lockUntil > now && existing.count >= maxRequests) {
    throw new AppError(
      'Too many authentication attempts from this IP. Please try again after 15 minutes.',
      429
    );
  }

  const resetWindow = !existing || existing.lockUntil <= now;
  const nextCount = resetWindow ? 1 : existing.count + 1;
  const windowEnd = resetWindow ? now + windowMs : existing.lockUntil;

  await LoginAttemptModel.updateOne(
    { key },
    {
      $set: {
        count: nextCount,
        lockUntil: windowEnd,
        expiresAt: new Date(windowEnd),
      },
    },
    { upsert: true }
  );
}
