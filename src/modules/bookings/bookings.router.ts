import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as bookingsController from './bookings.controller.js';

const router = Router();

// Public routes
router.post('/', bookingsController.createBooking);
router.get('/verify/:ref', bookingsController.getBookingByRef);

// Admin & Dining Floor routes
router.get('/admin', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER', 'STAFF'), bookingsController.getAdminBookings);
router.get('/admin/:id', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER', 'STAFF'), bookingsController.getBookingById);

router.patch('/admin/:id/status', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER', 'STAFF'), bookingsController.updateBookingStatus);

router.delete('/admin/:id', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), bookingsController.deleteBooking);

export default router;
