import { Router } from 'express';

// Primary Tier Routers
import adminRouter from '../api/admin/admin.router.js';
import staffRouter from '../api/staff/staff.router.js';
import customerRouter from '../api/customer/customer.router.js';
import webhooksRouter from '../api/webhooks/webhooks.router.js';

// Modular Feature Routers for Canonical /api/<module> & /api/v1/<module> Endpoints
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
import reviewsRouter from '../modules/reviews/reviews.router.js';
import settingsRouter from '../modules/settings/settings.router.js';
import reportsRouter from '../modules/reports/reports.router.js';
import analyticsRouter from '../modules/analytics/routes/analytics.routes.js';
import { uploadRouter } from '../modules/upload/index.js';
import { publicEventsRouter, adminEventsRouter } from '../modules/events/routes/event.routes.js';
import { publicInquiryRouter, adminInquiryRouter } from '../modules/events/routes/eventInquiry.routes.js';
import wishlistRouter from '../modules/wishlist/routes/wishlist.routes.js';
import { customerGalleryRouter, adminGalleryRouter } from '../modules/gallery/gallery.router.js';
import adminStaffRouter from '../modules/staff/staff.router.js';
import { adminOffersRouter, customerOffersRouter, offersRouter } from '../modules/offers/offers.router.js';
import { cartRouter } from '../modules/cart/index.js';
import { customerContactRouter, adminContactRouter, contactRouter } from '../modules/contact/index.js';
import { auditRouter } from '../modules/audit/index.js';
import { conversationsRouter } from '../modules/conversations/index.js';
import { deliveryRouter } from '../modules/delivery/index.js';
import { loyaltyRouter } from '../modules/loyalty/index.js';
import { pricingRouter } from '../modules/pricing/index.js';
import { restaurantRouter } from '../modules/restaurant/index.js';
import { tablesRouter } from '../modules/tables/index.js';
import { taxRouter } from '../modules/tax/index.js';
import { usersRouter } from '../modules/users/index.js';
import { notificationsRouter } from '../modules/notifications/index.js';

const mainRouter = Router();

// ============================================================================
// 1. PRIMARY ROLE-BASED & VERSIONED NAMESPACES
// ============================================================================

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

// Admin Management Portal (includes dedicated Admin Login: /api/v1/admin/auth/login)
mainRouter.use('/api/v1/admin', adminRouter);
mainRouter.use('/api/admin', adminRouter);

// Staff Operations Portal (includes dedicated Staff Login: /api/v1/staff/auth/login)
mainRouter.use('/api/v1/staff', staffRouter);
mainRouter.use('/api/staff', staffRouter);

// Customer Storefront & Public Operations
mainRouter.use('/api/v1/customer', customerRouter);
mainRouter.use('/api/customer', customerRouter);

// External Payment Gateway Webhooks
mainRouter.use('/api/v1/webhooks', webhooksRouter);
mainRouter.use('/api/webhooks', webhooksRouter);

// Central Authentication Router (/login, /admin/login, /staff/login, /refresh, /logout)
mainRouter.use('/api/v1/auth', authRouter);
mainRouter.use('/api/auth', authRouter);

// ============================================================================
// 2. DIRECT CANONICAL MODULE ROUTING (/api/<module> & /api/v1/<module>)
// Single, non-duplicated mounting for clean, high-performance dispatching
// ============================================================================
mainRouter.use(['/api/menu', '/api/v1/menu'], menuRouter);
mainRouter.use(['/api/categories', '/api/v1/categories'], categoriesRouter);
mainRouter.use(['/api/cart', '/api/v1/cart'], cartRouter);
mainRouter.use(['/api/orders', '/api/v1/orders'], ordersRouter);
mainRouter.use(['/api/bookings', '/api/v1/bookings'], bookingsRouter);
mainRouter.use(['/api/tables', '/api/v1/tables'], tablesRouter);
mainRouter.use(['/api/payments', '/api/v1/payments'], paymentsRouter);
mainRouter.use(['/api/invoices', '/api/v1/invoices'], invoicesRouter);
mainRouter.use(['/api/reviews', '/api/v1/reviews'], reviewsRouter);
mainRouter.use(['/api/restaurant', '/api/v1/restaurant'], restaurantRouter);
mainRouter.use(['/api/offers', '/api/v1/offers'], offersRouter);
mainRouter.use(['/api/delivery', '/api/v1/delivery'], deliveryRouter);
mainRouter.use(['/api/settings', '/api/v1/settings'], settingsRouter);
mainRouter.use(['/api/dashboard', '/api/v1/dashboard'], dashboardRouter);
mainRouter.use(['/api/reports', '/api/v1/reports'], reportsRouter);
mainRouter.use(['/api/analytics', '/api/v1/analytics'], analyticsRouter);
mainRouter.use(['/api/audit', '/api/v1/audit'], auditRouter);
mainRouter.use(['/api/users', '/api/v1/users'], usersRouter);
mainRouter.use(['/api/tax', '/api/v1/tax'], taxRouter);
mainRouter.use(['/api/customers', '/api/v1/customers'], customersRouter);
mainRouter.use(['/api/party', '/api/v1/party'], partyRouter);
mainRouter.use(['/api/promotions', '/api/v1/promotions'], promotionsRouter);
mainRouter.use(['/api/events', '/api/v1/events'], publicEventsRouter);
mainRouter.use(['/api/event-inquiries', '/api/v1/event-inquiries'], publicInquiryRouter);
mainRouter.use(['/api/wishlist', '/api/v1/wishlist'], wishlistRouter);
mainRouter.use(['/api/gallery', '/api/v1/gallery'], customerGalleryRouter);
mainRouter.use(['/api/contact', '/api/v1/contact'], contactRouter);
mainRouter.use(['/api/conversations', '/api/v1/conversations'], conversationsRouter);
mainRouter.use(['/api/loyalty', '/api/v1/loyalty'], loyaltyRouter);
mainRouter.use(['/api/pricing', '/api/v1/pricing'], pricingRouter);
mainRouter.use(['/api/notifications', '/api/v1/notifications'], notificationsRouter);
mainRouter.use(['/api/upload', '/api/v1/upload'], uploadRouter);

export default mainRouter;
