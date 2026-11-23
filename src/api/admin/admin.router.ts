import { Router, Request, Response } from 'express';
import { protect, restrictTo } from '../../middleware/auth.middleware.js';
import authRouter from '../../modules/auth/auth.router.js';
import dashboardRouter from '../../modules/dashboard/dashboard.router.js';
import menuRouter from '../../modules/menu/menu.router.js';
import categoriesRouter from '../../modules/categories/categories.router.js';
import ordersRouter from '../../modules/orders/orders.router.js';
import customersRouter from '../../modules/customers/customers.router.js';
import paymentsRouter from '../../modules/payments/payments.router.js';
import invoicesRouter from '../../modules/invoices/invoices.router.js';
import bookingsRouter from '../../modules/bookings/bookings.router.js';
import partyRouter from '../../modules/party/party.router.js';
import promotionsRouter from '../../modules/promotions/promotions.router.js';
import { adminGalleryRouter } from '../../modules/gallery/gallery.router.js';
import reviewsRouter from '../../modules/reviews/reviews.router.js';
import settingsRouter from '../../modules/settings/settings.router.js';
import reportsRouter from '../../modules/reports/reports.router.js';
import { uploadRouter } from '../../modules/upload/index.js';
import analyticsRouter from '../../modules/analytics/routes/analytics.routes.js';
import { adminEventsRouter } from '../../modules/events/routes/event.routes.js';
import { adminInquiryRouter } from '../../modules/events/routes/eventInquiry.routes.js';
import { auditRouter } from '../../modules/audit/index.js';
import { tablesRouter } from '../../modules/tables/index.js';
import { conversationsRouter } from '../../modules/conversations/index.js';
import { contactRouter } from '../../modules/contact/index.js';
import { deliveryRouter } from '../../modules/delivery/index.js';
import { loyaltyRouter } from '../../modules/loyalty/index.js';
import { offersRouter } from '../../modules/offers/index.js';
import { pricingRouter } from '../../modules/pricing/index.js';
import { restaurantRouter } from '../../modules/restaurant/index.js';
import { staffRouter } from '../../modules/staff/index.js';
import { taxRouter } from '../../modules/tax/index.js';
import { usersRouter } from '../../modules/users/index.js';
import { notificationsRouter } from '../../modules/notifications/index.js';
import { catchAsync } from '../../shared/utils/index.js';
import { sendSuccess } from '../../shared/responses/index.js';

const router = Router();

// Auth routes (Public login, protected me/password)
router.use('/auth', authRouter);

// Protected Admin Core
router.use(protect);

router.use('/dashboard', dashboardRouter);
router.use('/menu', menuRouter);
router.use('/categories', categoriesRouter);
router.use('/orders', ordersRouter);
router.use('/customers', customersRouter);
router.use('/payments', paymentsRouter);
router.use('/invoices', invoicesRouter);
router.use('/bookings', bookingsRouter);
router.use(['/party', '/party-inquiries'], partyRouter);
router.use('/promotions', promotionsRouter);
router.use('/gallery', adminGalleryRouter);
router.use('/reviews', reviewsRouter);
router.use('/settings', settingsRouter);
router.use('/reports', reportsRouter);
router.use('/analytics', analyticsRouter);
router.use('/upload', uploadRouter);
router.use('/events', adminEventsRouter);
router.use('/event-inquiries', adminInquiryRouter);
router.use('/audit', auditRouter);

// Dining Room Tables Management
router.use('/tables', tablesRouter);

// Live Conversations
router.use('/conversations', conversationsRouter);

// Contact Inquiries
router.use('/contact', contactRouter);

// Delivery Dispatch & Fleet Operations
router.use('/delivery', deliveryRouter);

// Loyalty & Diner Retention CRM
router.use('/loyalty', loyaltyRouter);

// Promotional Offers & Coupon Campaigns
router.use('/offers', offersRouter);

// Dynamic Pricing & Tax Engine
router.use('/pricing', pricingRouter);

// Restaurant Profile & Operating Controls
router.use('/restaurant', restaurantRouter);

// Staff Operations, KDS & Roster
router.use('/staff', staffRouter);

// Statutory GST & Tax Configuration
router.use('/tax', taxRouter);

// Staff & Administrative User Accounts
router.use('/users', usersRouter);

// In-App Alerts & Notifications
router.use('/notifications', notificationsRouter);

export default router;
