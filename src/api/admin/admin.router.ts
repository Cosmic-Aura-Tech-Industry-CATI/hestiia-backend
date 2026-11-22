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
import uploadRouter from '../../modules/upload/upload.router.js';
import analyticsRouter from '../../modules/analytics/routes/analytics.routes.js';
import { adminEventsRouter } from '../../modules/events/routes/event.routes.js';
import { adminInquiryRouter } from '../../modules/events/routes/eventInquiry.routes.js';
import tablesRouter from '../../modules/tables/tables.service.js';
import conversationsRouter from '../../modules/conversations/conversations.service.js';
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

// Tables
router.get('/tables', catchAsync(async (_req: Request, res: Response) => {
  const tables = await tablesRouter.getTables();
  sendSuccess(res, { tables });
}));

// Live Conversations
router.get('/conversations', catchAsync(async (_req: Request, res: Response) => {
  const conversations = await conversationsRouter.getAllConversations();
  sendSuccess(res, { conversations });
}));

router.get('/conversations/:orderNumber', catchAsync(async (req: Request, res: Response) => {
  const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
  const messages = await conversationsRouter.getMessagesByOrder(orderNumber);
  sendSuccess(res, { messages });
}));

router.post('/conversations/:orderNumber/reply', catchAsync(async (req: Request, res: Response) => {
  const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
  const { senderName, text } = req.body;
  const message = await conversationsRouter.sendMessage(orderNumber, 'admin', senderName || 'Staff', text);
  sendSuccess(res, { message }, 201);
}));

export default router;
