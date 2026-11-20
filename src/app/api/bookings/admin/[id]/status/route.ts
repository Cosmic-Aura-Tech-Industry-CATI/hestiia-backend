import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { bookingsService } from '@/services/bookings.service';

export const PATCH = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    const actor = user.name || user.username || 'Staff';
    const booking = await bookingsService.updateBookingStatus(
      id,
      {
        status: body?.status,
        staffNotes: body?.staffNotes,
        allocatedTable: body?.allocatedTable,
        confirmationMethod: body?.confirmationMethod,
      },
      actor
    );
    return apiJson(req, {
      success: true,
      booking,
      message: 'Booking status updated successfully.',
    });
  }
);
