export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';

export const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/hestiia_restaurant';

const rawJwtSecret = process.env.JWT_SECRET;
if (
  NODE_ENV === 'production' &&
  !IS_BUILD_PHASE &&
  (!rawJwtSecret || rawJwtSecret.length < 32)
) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable must be at least 32 characters in production.'
  );
}

export const JWT_SECRET =
  rawJwtSecret || 'dimisi_hestiia_super_secure_jwt_secret_2026';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
export const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3000';
export const ALLOWED_ORIGINS = Array.from(
  new Set([
    CLIENT_URL,
    ADMIN_URL,
    ...(process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : []),
  ])
);

export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
export const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'hestiia';

export const CURRENCY = 'INR';
export const CURRENCY_SYMBOL = '₹';
