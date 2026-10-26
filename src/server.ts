import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';

import { PORT, UPLOADS_DIR, NODE_ENV } from './shared/config/utils.js';
import { connectDB } from './shared/config/db.js';
import { globalErrorHandler } from './shared/middlewares/error.middleware.js';
import { AppError } from './shared/utils/appError.js';

// Module Routers
import authRouter from './modules/auth/auth.router.js';
import dashboardRouter from './modules/dashboard/dashboard.router.js';
import menuRouter from './modules/menu/menu.router.js';
import categoriesRouter from './modules/categories/categories.router.js';
import ordersRouter from './modules/orders/orders.router.js';
import customersRouter from './modules/customers/customers.router.js';
import paymentsRouter from './modules/payments/payments.router.js';
import invoicesRouter from './modules/invoices/invoices.router.js';
import bookingsRouter from './modules/bookings/bookings.router.js';
import partyRouter from './modules/party/party.router.js';
import promotionsRouter from './modules/promotions/promotions.router.js';
import galleryRouter from './modules/gallery/gallery.router.js';
import reviewsRouter from './modules/reviews/reviews.router.js';
import settingsRouter from './modules/settings/settings.router.js';
import reportsRouter from './modules/reports/reports.router.js';
import uploadRouter from './modules/upload/upload.router.js';

const app = express();

// 1. Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 2. CORS configuration (supports both Dashboard :3000 / :3001 and custom domains)
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// 3. Response compression (gzip)
app.use(compression());

// 4. Request parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 5. Prevent HTTP Parameter Pollution
app.use(hpp());

// 6. Rate Limiting for Auth Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
});
app.use(['/api/auth/login', '/api/admin/auth/login'], authLimiter);

// 7. Static file serving (dish & ambience uploads)
app.use('/uploads', express.static(UPLOADS_DIR));

// 8. Healthcheck
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    system: 'DIMISI Restaurant Management Platform',
    restaurant: 'HESTIIA RESTAURANT',
    architecture: 'DIMISI-OPS Modular Domain-Driven v2.0',
    timestamp: new Date().toISOString(),
  });
});

// 9. Mount Domain Modules (Backward-Compatible Routing)
app.use(['/api/auth', '/api/admin/auth'], authRouter);
app.use('/api/admin/dashboard', dashboardRouter);
app.use(['/api/menu', '/api/admin/menu'], menuRouter);
app.use(['/api/categories', '/api/admin/categories'], categoriesRouter);
app.use(['/api/orders', '/api/admin/orders'], ordersRouter);
app.use('/api/admin/customers', customersRouter);
app.use('/api/admin/payments', paymentsRouter);
app.use('/api/admin/invoices', invoicesRouter);
app.use(['/api/bookings', '/api/admin/bookings'], bookingsRouter);
app.use(['/api/party-inquiries', '/api/admin/party-inquiries'], partyRouter);
app.use(['/api/promotions', '/api/admin/promotions'], promotionsRouter);
app.use(['/api/gallery', '/api/admin/gallery'], galleryRouter);
app.use(['/api/reviews', '/api/admin/reviews'], reviewsRouter);
app.use(['/api/settings', '/api/admin/settings'], settingsRouter);
app.use('/api/admin/reports', reportsRouter);
app.use('/api/admin/upload', uploadRouter);

// 10. Unhandled route handler (Express v5 compatible)
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Cannot find endpoint ${req.originalUrl} on this server.`, 404));
});

// 11. Centralized Global Error Handler
app.use(globalErrorHandler);

// 12. Server Startup
export async function startServer() {
  await connectDB();

  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🍽️  HESTIIA RESTAURANT ADMIN SERVER (DIMISI-OPS STANDARD)`);
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
      console.log(`🛡️  Admin API ready: http://localhost:${PORT}/api/health`);
      console.log(`=======================================================`);
      resolve(server);
    });
  });
}

// Start when not under test runner
if (NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Fatal error starting server:', err);
  });
}

export default app;
