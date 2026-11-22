import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Extend Express Request interface with guestId
declare global {
  namespace Express {
    interface Request {
      guestId?: string;
    }
  }
}

export const GUEST_COOKIE_NAME = 'hestiia_guest_id';
const GUEST_ID_REGEX = /^gst_[a-f0-9]{32}$/i;
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function generateGuestId(): string {
  return 'gst_' + crypto.randomBytes(16).toString('hex');
}

export function isValidGuestId(id?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return GUEST_ID_REGEX.test(id.trim());
}

export function setGuestCookie(res: Response, guestId: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(GUEST_COOKIE_NAME, guestId, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

/**
 * Guest Identity Middleware
 * Resolves or securely initializes anonymous guest session with persistent 30-day cookie
 */
export function guestIdentityMiddleware(req: Request, res: Response, next: NextFunction): void {
  let guestId: string | undefined = req.cookies?.[GUEST_COOKIE_NAME];

  // Fallback to explicit X-Guest-ID header (e.g. for API clients / mobile / Postman)
  if (!guestId && req.headers['x-guest-id']) {
    const headerVal = req.headers['x-guest-id'];
    guestId = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  }

  // Validate format and integrity
  if (!guestId || !isValidGuestId(guestId)) {
    // Generate new cryptographically secure guest ID
    guestId = generateGuestId();
    setGuestCookie(res, guestId);
  } else {
    // Re-issue / refresh cookie max-age on valid request
    setGuestCookie(res, guestId);
  }

  req.guestId = guestId;
  next();
}

export default guestIdentityMiddleware;
