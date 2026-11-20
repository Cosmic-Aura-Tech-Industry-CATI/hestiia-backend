import { NextRequest } from 'next/server';
import { apiJson, withApiHandler } from '@/lib/errors';
import { bookingsService } from '@/services/bookings.service';

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const result = await bookingsService.createBooking(body);
  return apiJson(
    req,
    {
      success: true,
      bookingId: result.bookingId,
      bookingRef: result.bookingRef,
      message:
        'Your table reservation inquiry has been received. Our host will confirm availability with you shortly.',
      booking: result.booking,
      confirmation: result.confirmation,
    },
    201
  );
});
