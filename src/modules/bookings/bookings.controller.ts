import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { bookingsService } from './bookings.service.js';

export const createBooking = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingsService.createBooking(req.body);
  res.status(201).json({
    success: true,
    bookingId: result.bookingId,
    bookingRef: result.bookingRef,
    message: 'Your table reservation inquiry has been received. Our host will confirm availability with you shortly.',
    booking: result.booking,
    confirmation: result.confirmation,
  });
});

export const getBookingByRef = catchAsync(async (req: Request, res: Response) => {
  const ref = Array.isArray(req.params.ref) ? req.params.ref[0] : req.params.ref;
  const confirmation = await bookingsService.getBookingByRef(String(ref));
  res.status(200).json({
    success: true,
    confirmation,
  });
});

export const getAdminBookings = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await bookingsService.getAdminBookings(req.query);
  res.status(200).json({ success: true, ...result });
});

export const updateBookingStatus = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const actor = req.user?.name || req.user?.username || 'Staff';
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const booking = await bookingsService.updateBookingStatus(
    String(id),
    {
      status: req.body.status,
      staffNotes: req.body.staffNotes,
      allocatedTable: req.body.allocatedTable,
      confirmationMethod: req.body.confirmationMethod,
    },
    actor
  );
  res.status(200).json({
    success: true,
    booking,
    message: 'Booking status updated successfully.',
  });
});
