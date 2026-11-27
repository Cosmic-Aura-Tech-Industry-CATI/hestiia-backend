import cors from 'cors';
import { ENV } from './env.js';

const allowedOrigins = [
  ENV.CLIENT_URL,
  ENV.ADMIN_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://hestiiarestaurant.com',
  'https://admin.hestiiarestaurant.com',
].filter(Boolean);

export const corsConfig = cors({
  origin: (origin, callback) => {
    // Allow non-browser agents (Postman, curl, server-to-server) where origin is undefined
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not permitted by CORS policy`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
});

export default corsConfig;
