import { Router } from 'express';
import customerRouter from '../api/customer/customer.router.js';
import adminRouter from '../api/admin/admin.router.js';
import staffRouter from '../api/staff/staff.router.js';
import webhooksRouter from '../api/webhooks/webhooks.router.js';

// Legacy Module Routers for 100% Backward Compatibility with existing frontend clients
import authRouter from '../modules/auth/auth.router.js';
import dashboardRouter from '../modules/dashboard/dashboard.router.js';
import menuRouter from '../modules/menu/menu.router.js';
import categoriesRouter from '../modules/categories/categories.router.js';
import ordersRouter from '../modules/orders/orders.router.js';
import customersRouter from '../modules/customers/customers.router.js';
import paymentsRouter from '../modules/payments/payments.router.js';
import invoicesRouter from '../modules/invoices/invoices.router.js';
import bookingsRouter from '../modules/bookings/bookings.router.js';
import partyRouter from '../modules/party/party.router.js';
import promotionsRouter from '../modules/promotions/promotions.router.js';
import galleryRouter from '../modules/gallery/gallery.router.js';
import reviewsRouter from '../modules/reviews/reviews.router.js';
import settingsRouter from '../modules/settings/settings.router.js';
import reportsRouter from '../modules/reports/reports.router.js';
import uploadRouter from '../modules/upload/upload.router.js';

const mainRouter = Router();

// Version 1 Architecture Namespaces
mainRouter.use('/api/v1/customer', customerRouter);
mainRouter.use('/api/v1/admin', adminRouter);
mainRouter.use('/api/v1/staff', staffRouter);
mainRouter.use('/api/v1/webhooks', webhooksRouter);

// Backward Compatible Routes (Mounts existing endpoints without breaking existing Dashboard or Web UI)
mainRouter.use(['/api/auth', '/api/admin/auth', '/api/v1/auth', '/auth'], authRouter);
mainRouter.use('/api/admin/dashboard', dashboardRouter);
mainRouter.use(['/api/menu', '/api/admin/menu'], menuRouter);
mainRouter.use(['/api/categories', '/api/admin/categories'], categoriesRouter);
mainRouter.use(['/api/orders', '/api/admin/orders'], ordersRouter);
mainRouter.use('/api/admin/customers', customersRouter);
mainRouter.use('/api/admin/payments', paymentsRouter);
mainRouter.use('/api/admin/invoices', invoicesRouter);
mainRouter.use(['/api/bookings', '/api/admin/bookings'], bookingsRouter);
mainRouter.use(['/api/party-inquiries', '/api/admin/party-inquiries'], partyRouter);
mainRouter.use(['/api/promotions', '/api/admin/promotions'], promotionsRouter);
mainRouter.use(['/api/gallery', '/api/admin/gallery'], galleryRouter);
mainRouter.use(['/api/reviews', '/api/admin/reviews'], reviewsRouter);
mainRouter.use(['/api/settings', '/api/admin/settings'], settingsRouter);
mainRouter.use('/api/admin/reports', reportsRouter);
mainRouter.use('/api/admin/upload', uploadRouter);

export default mainRouter;
