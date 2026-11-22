import { Router, Request, Response } from 'express';
import { menuService } from '../../modules/menu/menu.service.js';
import { categoriesService } from '../../modules/categories/categories.service.js';
import { ordersService } from '../../modules/orders/orders.service.js';
import { paymentsService } from '../../modules/payments/payments.service.js';
import { bookingsService } from '../../modules/bookings/bookings.service.js';
import { partyService } from '../../modules/party/party.service.js';
import { reviewsService } from '../../modules/reviews/reviews.service.js';
import { conversationsService } from '../../modules/conversations/conversations.service.js';
import { invoicesService } from '../../modules/invoices/invoices.service.js';
import { restaurantService } from '../../modules/restaurant/restaurant.service.js';
import { catchAsync } from '../../shared/utils/index.js';
import { sendSuccess } from '../../shared/responses/index.js';

const router = Router();

// 1. Restaurant Details & Public Settings
router.get('/restaurant', catchAsync(async (_req: Request, res: Response) => {
  const info = await restaurantService.getInfo();
  sendSuccess(res, { restaurant: info });
}));

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

// 5. Dining Table Reservations
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
router.get('/conversations/:orderNumber', catchAsync(async (req: Request, res: Response) => {
  const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
  const messages = await conversationsService.getMessagesByOrder(orderNumber);
  sendSuccess(res, { messages });
}));

router.post('/conversations/:orderNumber', catchAsync(async (req: Request, res: Response) => {
  const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
  const { senderName, text } = req.body;
  const message = await conversationsService.sendMessage(orderNumber, 'customer', senderName || 'Customer', text);
  sendSuccess(res, { message }, 201);
}));

// 8. Reviews
router.get('/reviews', catchAsync(async (_req: Request, res: Response) => {
  const result = await reviewsService.getPublicReviews();
  sendSuccess(res, result);
}));

router.post('/reviews', catchAsync(async (req: Request, res: Response) => {
  const review = await reviewsService.submitReview(req.body);
  sendSuccess(res, { review }, 201, 'Review submitted for moderation');
}));

export default router;
