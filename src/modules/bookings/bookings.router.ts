import { Router } from 'express';
import { protect } from '../../shared/middlewares/auth.middleware.js';
import * as bookingsController from './bookings.controller.js';

const router = Router();

// Public
router.post('/', bookingsController.createBooking);
router.get('/verify/:ref', bookingsController.getBookingByRef);

// Admin
router.get('/admin/all', protect, bookingsController.getAdminBookings);
router.patch('/admin/:id/status', protect, bookingsController.updateBookingStatus);

export default router;
