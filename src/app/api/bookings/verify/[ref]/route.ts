import { NextRequest } from 'next/server';
import { apiJson, withApiHandler } from '@/lib/errors';
import { bookingsService } from '@/services/bookings.service';

export const GET = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ ref: string }> }) => {
    const { ref } = await context.params;
    const confirmation = await bookingsService.getBookingByRef(ref);
    return apiJson(req, { success: true, confirmation });
  }
);
