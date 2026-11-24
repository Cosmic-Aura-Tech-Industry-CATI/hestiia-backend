import { Router, Request, Response } from 'express';
import { menuService } from '../../modules/menu/menu.service.js';
import { categoriesService } from '../../modules/categories/categories.service.js';
import { ordersService } from '../../modules/orders/orders.service.js';
import { paymentsService } from '../../modules/payments/payments.service.js';
import { bookingsService } from '../../modules/bookings/bookings.service.js';
import { partyService } from '../../modules/party/party.service.js';
import { reviewsService } from '../../modules/reviews/reviews.service.js';
import { conversationsRouter } from '../../modules/conversations/index.js';
import { invoicesService } from '../../modules/invoices/invoices.service.js';
import { restaurantRouter } from '../../modules/restaurant/index.js';
import { publicEventsRouter } from '../../modules/events/routes/event.routes.js';
import { publicInquiryRouter } from '../../modules/events/routes/eventInquiry.routes.js';
import wishlistRouter from '../../modules/wishlist/routes/wishlist.routes.js';
import { cartRouter } from '../../modules/cart/index.js';
import { customerGalleryRouter } from '../../modules/gallery/gallery.router.js';
import { contactRouter } from '../../modules/contact/index.js';
import { deliveryRouter } from '../../modules/delivery/index.js';
import { loyaltyRouter } from '../../modules/loyalty/index.js';
import { offersRouter } from '../../modules/offers/index.js';
import { pricingRouter } from '../../modules/pricing/index.js';
import { tablesRouter } from '../../modules/tables/index.js';
import { notificationsRouter } from '../../modules/notifications/index.js';
import { catchAsync } from '../../shared/utils/index.js';
import { sendSuccess } from '../../shared/responses/index.js';

const router = Router();

// 1. Restaurant Details, Status & Public Settings
router.use('/restaurant', restaurantRouter);

// 2. Menu & Categories
router.get('/menu', catchAsync(async (req: Request, res: Response) => {
  const result = await menuService.getPublicMenu(req.query as any);
  sendSuccess(res, result);
}));

router.get('/categories', catchAsync(async (_req: Request, res: Response) => {
  const result = await categoriesService.getPublicCategories();
  sendSuccess(res, result);
}));

// 3. Orders & Tracking
router.post('/orders', catchAsync(async (req: Request, res: Response) => {
  const result = await ordersService.createOrder(req.body);
  sendSuccess(res, result, 201, 'Order placed successfully');
}));

router.get('/orders/:id', catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await ordersService.getOrderDetails(id);
  sendSuccess(res, result);
}));

router.post('/orders/initiate-payment', catchAsync(async (req: Request, res: Response) => {
  const result = await paymentsService.createPaymentIntent(req.body);
  sendSuccess(res, result, 200, 'Payment intent created');
}));

router.post('/orders/verify-payment', catchAsync(async (req: Request, res: Response) => {
  const payment = await paymentsService.verifyOnlinePayment(req.body);
  sendSuccess(res, { payment }, 200, 'Payment verified successfully');
}));

router.post('/orders/submit-upi', catchAsync(async (req: Request, res: Response) => {
  const payment = await paymentsService.submitManualUpiReference(req.body);
  sendSuccess(res, { payment }, 200, 'UPI reference submitted for verification');
}));

router.post('/orders/:id/cancel', catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const order = await ordersService.cancelOrder(id, req.body.reason, 'Customer', true);
  sendSuccess(res, { order }, 200, 'Order cancelled successfully');
}));

// 4. Invoices
router.get('/invoices/:id', catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await invoicesService.getInvoiceDetails(id);
  sendSuccess(res, result);
}));

// 5. Dining Table Reservations & Floor Plan
router.use('/tables', tablesRouter);

// Notifications & Live In-App Alerts
router.use('/notifications', notificationsRouter);

router.post('/bookings', catchAsync(async (req: Request, res: Response) => {
  const result = await bookingsService.createBooking(req.body);
  sendSuccess(res, result, 201, 'Table reservation requested');
}));

router.get('/bookings/:ref', catchAsync(async (req: Request, res: Response) => {
  const ref = Array.isArray(req.params.ref) ? req.params.ref[0] : req.params.ref;
  const result = await bookingsService.getBookingByRef(ref);
  sendSuccess(res, { confirmation: result });
}));

// 6. Party / Banquet Inquiries
router.post('/party', catchAsync(async (req: Request, res: Response) => {
  const result = await partyService.createInquiry(req.body);
  sendSuccess(res, result, 201, 'Banquet inquiry submitted');
}));

// 7. Live Order Chat
router.use('/conversations', conversationsRouter);

// 8. Reviews
router.get('/reviews', catchAsync(async (_req: Request, res: Response) => {
  const result = await reviewsService.getPublicReviews();
  sendSuccess(res, result);
}));

router.post('/reviews', catchAsync(async (req: Request, res: Response) => {
  const review = await reviewsService.submitReview(req.body);
  sendSuccess(res, { review }, 201, 'Review submitted for moderation');
}));

// 9. Events & Event Inquiries
router.use('/events', publicEventsRouter);
router.use('/event-inquiries', publicInquiryRouter);

// 10. Guest Wishlist & Dining Tray Cart
router.use('/wishlist', wishlistRouter);
router.use('/cart', cartRouter);

// 11. Public Gallery & Guest Customer Uploads
router.use('/gallery', customerGalleryRouter);

// 12. Contact Inquiries
router.use('/contact', contactRouter);

// 13. Delivery Tracking & Serviceability
router.use('/delivery', deliveryRouter);

// 14. Loyalty Dining Club & Rewards
router.use('/loyalty', loyaltyRouter);

// 15. Promotional Offers & Coupons
router.use('/offers', offersRouter);

// 16. Dynamic Pricing, Surcharges & Bill Quotations
router.use('/pricing', pricingRouter);

export default router;
