import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const PORT = parseInt(process.env.PORT || '5000', 10);
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hestiia_restaurant';

// JWT Configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'dimisi_hestiia_super_secure_jwt_secret_2026';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '7d';
export const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || JWT_SECRET;
export const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}_refresh_key_2026`;
export const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Security & Password Hashing
export const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

// Cookie Settings
export const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
export const COOKIE_SAME_SITE = (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax';

// Superadmin Bootstrap Credentials
export const INITIAL_SUPERADMIN_NAME = process.env.INITIAL_SUPERADMIN_NAME || 'Hestiia Superadmin';
export const INITIAL_SUPERADMIN_EMAIL = process.env.INITIAL_SUPERADMIN_EMAIL || 'admin@hestiia.com';
export const INITIAL_SUPERADMIN_PASSWORD = process.env.INITIAL_SUPERADMIN_PASSWORD || 'Superadmin@Hestiia2026';
export const ADMIN_SETUP_SECRET = process.env.ADMIN_SETUP_SECRET || process.env.JWT_SECRET || 'dimisi_hestiia_admin_secret_2026';

// Application Settings
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
export const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3000';

// Upload Paths
export const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');
export const MENU_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'menu');

// Cloudinary
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
export const CLOUDINARY_URL = process.env.CLOUDINARY_URL || '';

// Resend Email Dispatch
export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
export const EMAIL_FROM = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'Hestiia Restaurant <onboarding@resend.dev>';

// Financial Currency
export const CURRENCY = 'INR';
export const CURRENCY_SYMBOL = '₹';
