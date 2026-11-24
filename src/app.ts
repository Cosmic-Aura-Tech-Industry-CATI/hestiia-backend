import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';
import path from 'path';

import { ENV } from './config/env.js';
import { corsConfig } from './config/cors.js';
import { authLimiter } from './middleware/rateLimiter.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { AppError, NotFoundError } from './shared/errors/index.js';
import mainRouter from './routes/index.js';
import './events/orderEvents.js';

export const app = express();

// 1. Security & Core Middlewares
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(corsConfig);
app.use(compression());
app.use(
  express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(hpp());

// 2. Rate Limiting for Sensitive Auth Routes (Admin & Staff Logins)
app.use(
  [
    '/api/auth/login',
    '/api/v1/auth/login',
    '/api/admin/auth/login',
    '/api/v1/admin/auth/login',
    '/api/admin/login',
    '/api/v1/admin/login',
    '/api/staff/auth/login',
    '/api/v1/staff/auth/login',
    '/api/staff/login',
    '/api/v1/staff/login',
  ],
  authLimiter
);

// 3. Static Assets
app.use('/uploads', express.static(ENV.UPLOADS_DIR));
app.use('/menu', express.static(path.resolve(process.cwd(), 'public', 'uploads', 'menu')));

// 4. System Healthcheck
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    system: 'DIMISI Restaurant Management Platform',
    restaurant: 'HESTIIA RESTAURANT',
    architecture: 'Modular Monolith v1.0 (Enterprise Standard)',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    version: 'v1.0',
    system: 'Hestiia Modular Monolith API',
    timestamp: new Date().toISOString(),
  });
});

// 5. Mount Unified Routes
app.use(mainRouter);

// 6. Centralized 404 Handler for all Unmatched Endpoints & Methods
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError(`Cannot find ${req.method} ${req.originalUrl} on this server.`));
});

// 7. Global Centralized Error Handler
app.use(errorHandler);

export default app;
