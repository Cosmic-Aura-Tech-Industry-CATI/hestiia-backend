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
import analyticsRouter from '../modules/analytics/routes/analytics.routes.js';
import { publicEventsRouter, adminEventsRouter } from '../modules/events/routes/event.routes.js';
import { publicInquiryRouter, adminInquiryRouter } from '../modules/events/routes/eventInquiry.routes.js';
import wishlistRouter from '../modules/wishlist/routes/wishlist.routes.js';
import { customerGalleryRouter, adminGalleryRouter } from '../modules/gallery/gallery.router.js';
import adminStaffRouter from '../modules/staff/staff.router.js';
import { adminOffersRouter, customerOffersRouter } from '../modules/offers/offers.router.js';
import cartRouter from '../modules/cart/routes/cart.routes.js';
import { customerContactRouter, adminContactRouter } from '../modules/contact/contact.routes.js';

const mainRouter = Router();

// Version 1 Architecture Namespaces
mainRouter.use('/api/v1/customer', customerRouter);
mainRouter.use('/api/v1/admin', adminRouter);
mainRouter.use('/api/v1/staff', staffRouter);
mainRouter.use('/api/v1/webhooks', webhooksRouter);

// Backward Compatible & Canonical Versioned Routes (eliminates 404s across all URL variations)
mainRouter.use(['/api/auth', '/api/admin/auth', '/api/v1/auth', '/api/v1/admin/auth', '/auth'], authRouter);
mainRouter.use(['/api/dashboard', '/api/admin/dashboard', '/api/v1/dashboard', '/api/v1/admin/dashboard'], dashboardRouter);
mainRouter.use(['/api/menu', '/api/v1/menu', '/api/admin/menu', '/api/v1/admin/menu'], menuRouter);
mainRouter.use(['/api/categories', '/api/v1/categories', '/api/admin/categories', '/api/v1/admin/categories'], categoriesRouter);
mainRouter.use(['/api/orders', '/api/v1/orders', '/api/admin/orders', '/api/v1/admin/orders'], ordersRouter);
mainRouter.use(['/api/customers', '/api/v1/customers', '/api/admin/customers', '/api/v1/admin/customers'], customersRouter);
mainRouter.use(['/api/payments', '/api/v1/payments', '/api/admin/payments', '/api/v1/admin/payments'], paymentsRouter);
mainRouter.use(['/api/invoices', '/api/v1/invoices', '/api/admin/invoices', '/api/v1/admin/invoices'], invoicesRouter);
mainRouter.use(['/api/bookings', '/api/v1/bookings', '/api/admin/bookings', '/api/v1/admin/bookings'], bookingsRouter);
mainRouter.use(['/api/party', '/api/v1/party', '/api/party-inquiries', '/api/v1/party-inquiries', '/api/admin/party', '/api/v1/admin/party', '/api/admin/party-inquiries', '/api/v1/admin/party-inquiries'], partyRouter);
mainRouter.use(['/api/promotions', '/api/v1/promotions', '/api/admin/promotions', '/api/v1/admin/promotions'], promotionsRouter);
mainRouter.use(['/api/reviews', '/api/v1/reviews', '/api/admin/reviews', '/api/v1/admin/reviews'], reviewsRouter);
mainRouter.use(['/api/settings', '/api/v1/settings', '/api/admin/settings', '/api/v1/admin/settings'], settingsRouter);
mainRouter.use(['/api/reports', '/api/v1/reports', '/api/admin/reports', '/api/v1/admin/reports'], reportsRouter);
mainRouter.use(['/api/analytics', '/api/v1/analytics', '/api/admin/analytics', '/api/v1/admin/analytics'], analyticsRouter);
mainRouter.use(['/api/upload', '/api/v1/upload', '/api/admin/upload', '/api/v1/admin/upload'], uploadRouter);
mainRouter.use(['/api/events', '/api/v1/events', '/api/v1/customer/events'], publicEventsRouter);
mainRouter.use(['/api/admin/events', '/api/v1/admin/events'], adminEventsRouter);
mainRouter.use(['/api/event-inquiries', '/api/v1/event-inquiries', '/api/v1/customer/event-inquiries'], publicInquiryRouter);
mainRouter.use(['/api/admin/event-inquiries', '/api/v1/admin/event-inquiries'], adminInquiryRouter);
mainRouter.use(['/api/wishlist', '/api/v1/wishlist', '/api/v1/customer/wishlist'], wishlistRouter);
mainRouter.use(['/api/gallery', '/api/v1/gallery', '/api/v1/customer/gallery'], customerGalleryRouter);
mainRouter.use(['/api/admin/gallery', '/api/v1/admin/gallery'], adminGalleryRouter);
mainRouter.use(['/api/staff', '/api/admin/staff', '/api/v1/admin/staff'], adminStaffRouter);
mainRouter.use(['/api/customer/offers', '/api/v1/customer/offers', '/api/offers', '/api/v1/offers'], customerOffersRouter);
mainRouter.use(['/api/admin/offers', '/api/v1/admin/offers'], adminOffersRouter);
mainRouter.use(['/api/customer/cart', '/api/v1/customer/cart', '/api/cart', '/api/v1/cart'], cartRouter);
mainRouter.use(['/api/customer/contact', '/api/v1/customer/contact', '/api/contact', '/api/v1/contact'], customerContactRouter);
mainRouter.use(['/api/admin/contact', '/api/v1/admin/contact'], adminContactRouter);

export default mainRouter;
