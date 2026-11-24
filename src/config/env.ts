import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/hestiia_restaurant',
  JWT_SECRET: process.env.JWT_SECRET || 'dimisi_hestiia_super_secure_jwt_secret_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  APP_TIMEZONE: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  ADMIN_URL: process.env.ADMIN_URL || 'http://localhost:3000',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  CLOUDINARY_URL: process.env.CLOUDINARY_URL || '',
  UPLOADS_DIR: path.resolve(process.cwd(), 'public', 'uploads'),
  CURRENCY: 'INR',
  CURRENCY_SYMBOL: '₹',
};

export default ENV;
