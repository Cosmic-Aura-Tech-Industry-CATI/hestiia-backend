import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as bookingsController from './bookings.controller.js';

const router = Router();

// Public routes
router.post('/', bookingsController.createBooking);
router.get('/verify/:ref', bookingsController.getBookingByRef);

// Admin routes
router.get('/admin', protect, restrictTo('SUPERADMIN', 'MANAGER'), bookingsController.getAdminBookings);
router.get('/admin/:id', protect, restrictTo('SUPERADMIN', 'MANAGER'), bookingsController.getBookingById);

router.patch('/admin/:id/status', protect, restrictTo('SUPERADMIN', 'MANAGER'), bookingsController.updateBookingStatus);

router.delete('/admin/:id', protect, restrictTo('SUPERADMIN'), bookingsController.deleteBooking);

export default router;
