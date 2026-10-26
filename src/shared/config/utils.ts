import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const PORT = parseInt(process.env.PORT || '5000', 10);
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hestiia_restaurant';
export const JWT_SECRET = process.env.JWT_SECRET || 'dimisi_hestiia_super_secure_jwt_secret_2026';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
export const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3000';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');
export const DATA_DIR = path.resolve(process.cwd(), 'data');

export const CURRENCY = 'INR';
export const CURRENCY_SYMBOL = '₹';
