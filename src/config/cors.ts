import cors from 'cors';
import { ENV } from './env.js';

const allowedOrigins = [
  ENV.CLIENT_URL,
  ENV.ADMIN_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
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
