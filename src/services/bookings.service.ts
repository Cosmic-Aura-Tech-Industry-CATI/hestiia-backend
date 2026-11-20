import { AppError } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';
import { logAudit } from '@/lib/audit';
import { escapeRegex } from '@/lib/regex';
import { BookingModel, ITableBooking } from '@/models/Booking.model';
import { cleanDoc, cleanDocs } from '@/models/_schema';

const RESTAURANT_PROFILE = {
  name: 'Hestiia Restaurant & Fine Dine',
  tagline: 'Pure Vegetarian Culinary Sanctuary',
  phone: '078808 40622',
  address: '1-B, Ram Puram, Shyam Nagar',
  city: 'Kanpur, Uttar Pradesh 208013',
  landmark: 'Opp. PAC Morh, Shyam Nagar',
  mapQuery: 'Hestiia+Restaurant+Shyam+Nagar+Kanpur',
  holdPolicy: 'Table is held for 15 minutes beyond your reserved time slot before release.',
};

function generateBookingRef(dateStr: string): string {
  const cleanDate = (dateStr || '').replace(/\D/g, '').slice(2, 6);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `HST-TB-${cleanDate || 'VIP'}-${randomSuffix}`;
}

export const bookingsService = {
  async createBooking(data: any) {
    const name = (data.name || data.customerName || '')?.trim();
    const phone = (data.phone || '')?.trim();
    const email = data.email ? String(data.email).trim() : undefined;
    const date = (data.date || '')?.trim();
    const time = (data.time || '')?.trim();
    const guests = data.guests ? String(data.guests).trim() : '2 Guests';
    const occasion = data.occasion ? String(data.occasion).trim() : 'Dining';
    const requests =
      data.requests || data.specialRequests
        ? String(data.requests || data.specialRequests).trim()
        : undefined;

    if (!name || !phone || !date || !time) {
      throw new AppError(
        'Name, phone number, date, and preferred time slot are required.',
        400
      );
    }

    await connectDB();
    const now = new Date().toISOString();
    const id = `tb_${Date.now()}`;
    const bookingRef = generateBookingRef(date);

    const newBooking: ITableBooking = {
      id,
      bookingRef,
      customerName: name,
      phone,
      email,
      date,
      time,
      guests,
      occasion,
      specialRequests: requests,
      status: 'new',
      holdPolicy: RESTAURANT_PROFILE.holdPolicy,
      staffNotes: '',
      createdAt: now,
      updatedAt: now,
    };

    await BookingModel.create(newBooking);
    await logAudit(
      'TABLE_BOOKING_REQUESTED',
      'Public Customer',
      `Reservation inquiry #${bookingRef} (${id}) by ${name} for ${date} ${time}`
    );

    const confirmation = {
      id,
      bookingRef,
      customerName: name,
      phone,
      email,
      date,
      time,
      guests,
      occasion,
      specialRequests: requests,
      status: 'new',
      allocatedTable: undefined,
      holdPolicy: RESTAURANT_PROFILE.holdPolicy,
      restaurantDetails: RESTAURANT_PROFILE,
      createdAt: now,
    };

    return { bookingId: id, bookingRef, booking: newBooking, confirmation };
  },

  async getBookingByRef(ref: string) {
    await connectDB();
    const cleanRef = String(ref || '').trim();
    const rx = new RegExp(`^${escapeRegex(cleanRef)}$`, 'i');
    const found = await BookingModel.findOne({
      $or: [{ bookingRef: rx }, { id: rx }],
    }).lean();

    if (!found) {
      throw new AppError(`Booking confirmation not found with reference: ${ref}`, 404);
    }

    const b = cleanDoc<ITableBooking>(found);
    return {
      id: b.id,
      bookingRef: b.bookingRef || `HST-TB-RES-${b.id.slice(-4)}`,
      customerName: b.customerName,
      phone: b.phone,
      email: b.email,
      date: b.date,
      time: b.time,
      guests: b.guests,
      occasion: b.occasion,
      specialRequests: b.specialRequests,
      status: b.status,
      allocatedTable: b.allocatedTable,
      holdPolicy: b.holdPolicy || RESTAURANT_PROFILE.holdPolicy,
      restaurantDetails: RESTAURANT_PROFILE,
      confirmedAt: b.confirmedAt,
      createdAt: b.createdAt,
    };
  },

  async getAdminBookings(query: any) {
    await connectDB();
    const { search, status, date, page = '1', limit = '20' } = query;

    const filter: Record<string, any> = {};
    if (search) {
      const rx = new RegExp(escapeRegex(String(search)), 'i');
      filter.$or = [
        { customerName: rx },
        { phone: rx },
        { bookingRef: rx },
        { email: rx },
      ];
    }
    if (status && status !== 'all') filter.status = status;
    if (date) filter.date = String(date);

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [total, rawBookings] = await Promise.all([
      BookingModel.countDocuments(filter),
      BookingModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return {
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      bookings: cleanDocs<ITableBooking>(rawBookings),
    };
  },

  async updateBookingStatus(
    bookingId: string,
    payload: {
      status?: string;
      staffNotes?: string;
      allocatedTable?: string;
      confirmationMethod?: 'on-screen' | 'whatsapp' | 'call';
    },
    actor = 'Staff'
  ) {
    await connectDB();
    const { status, staffNotes, allocatedTable, confirmationMethod } = payload;
    const existing = await BookingModel.findOne({
      $or: [{ id: bookingId }, { bookingRef: bookingId }],
    }).lean();

    if (!existing) {
      throw new AppError('Table booking not found.', 404);
    }

    const now = new Date().toISOString();
    const updates: Record<string, any> = { updatedAt: now };
    if (status) {
      updates.status = status;
      if (status === 'confirmed' && !existing.confirmedAt) {
        updates.confirmedAt = now;
      }
    }
    if (staffNotes !== undefined) updates.staffNotes = String(staffNotes).trim();
    if (allocatedTable !== undefined) {
      updates.allocatedTable = String(allocatedTable).trim();
    }
    if (confirmationMethod !== undefined) {
      updates.confirmationMethod = confirmationMethod;
    }

    const updated = await BookingModel.findOneAndUpdate(
      { id: existing.id },
      { $set: updates },
      { new: true }
    ).lean();

    const clean = cleanDoc<ITableBooking>(updated);
    await logAudit(
      'BOOKING_STATUS_CHANGED',
      actor,
      `Booking #${clean.bookingRef || bookingId} status updated to ${status}${allocatedTable ? ` (Table: ${allocatedTable})` : ''}`
    );
    return clean;
  },
};
