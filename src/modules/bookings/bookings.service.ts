import { db, type TableBooking } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';
import type { CreateBookingDTO, UpdateBookingStatusDTO, BookingConfirmationDTO } from './bookings.dto.js';

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
  async createBooking(data: CreateBookingDTO) {
    const name = (data.name || data.customerName || '')?.trim();
    const phone = (data.phone || '')?.trim();
    const email = data.email ? String(data.email).trim() : undefined;
    const date = (data.date || '')?.trim();
    const time = (data.time || '')?.trim();
    const guests = data.guests ? String(data.guests).trim() : '2 Guests';
    const occasion = data.occasion ? String(data.occasion).trim() : 'Dining';
    const requests = (data.requests || data.specialRequests) ? String(data.requests || data.specialRequests).trim() : undefined;

    if (!name || !phone || !date || !time) {
      throw new AppError('Name, phone number, date, and preferred time slot are required.', 400);
    }

    const now = new Date().toISOString();
    const id = 'tb_' + Date.now();
    const bookingRef = generateBookingRef(date);

    const newBooking: TableBooking = {
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

    db.updateState((s) => s.bookings.unshift(newBooking));
    db.logAudit('TABLE_BOOKING_REQUESTED', 'Public Customer', `Reservation inquiry #${bookingRef} (${id}) by ${name} for ${date} ${time}`);

    const confirmation: BookingConfirmationDTO = {
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

  async getBookingByRef(ref: string): Promise<BookingConfirmationDTO> {
    const cleanRef = String(ref || '').trim().toLowerCase();
    const all = db.getState().bookings;
    const found = all.find(
      (b) =>
        (b.bookingRef && b.bookingRef.toLowerCase() === cleanRef) ||
        b.id.toLowerCase() === cleanRef
    );

    if (!found) {
      throw new AppError('Booking confirmation not found with reference: ' + ref, 404);
    }

    return {
      id: found.id,
      bookingRef: found.bookingRef || `HST-TB-RES-${found.id.slice(-4)}`,
      customerName: found.customerName,
      phone: found.phone,
      email: found.email,
      date: found.date,
      time: found.time,
      guests: found.guests,
      occasion: found.occasion,
      specialRequests: found.specialRequests,
      status: found.status,
      allocatedTable: found.allocatedTable,
      holdPolicy: found.holdPolicy || RESTAURANT_PROFILE.holdPolicy,
      restaurantDetails: RESTAURANT_PROFILE,
      confirmedAt: found.confirmedAt,
      createdAt: found.createdAt,
    };
  },

  async getAdminBookings(query: any) {
    const { search, status, date, page = '1', limit = '20' } = query;
    let bookings = [...db.getState().bookings];

    if (search) {
      const q = String(search).toLowerCase();
      bookings = bookings.filter(
        (b) =>
          b.customerName.toLowerCase().includes(q) ||
          b.phone.includes(q) ||
          (b.bookingRef && b.bookingRef.toLowerCase().includes(q)) ||
          (b.email && b.email.toLowerCase().includes(q))
      );
    }

    if (status && status !== 'all') {
      bookings = bookings.filter((b) => b.status === status);
    }

    if (date) {
      bookings = bookings.filter((b) => b.date === String(date));
    }

    bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = bookings.slice(startIndex, startIndex + limitNum);

    return {
      total: bookings.length,
      page: pageNum,
      totalPages: Math.ceil(bookings.length / limitNum),
      bookings: paginated,
    };
  },

  async updateBookingStatus(
    bookingId: string,
    payload: { status?: string; staffNotes?: string; allocatedTable?: string; confirmationMethod?: 'on-screen' | 'whatsapp' | 'call' },
    actor = 'Staff'
  ) {
    const { status, staffNotes, allocatedTable, confirmationMethod } = payload;
    let updated: TableBooking | null = null;
    const now = new Date().toISOString();

    db.updateState((s) => {
      const target = s.bookings.find((b) => b.id === bookingId || b.bookingRef === bookingId);
      if (target) {
        if (status) {
          target.status = status as any;
          if (status === 'confirmed' && !target.confirmedAt) {
            target.confirmedAt = now;
          }
        }
        if (staffNotes !== undefined) target.staffNotes = String(staffNotes).trim();
        if (allocatedTable !== undefined) target.allocatedTable = String(allocatedTable).trim();
        if (confirmationMethod !== undefined) target.confirmationMethod = confirmationMethod;
        target.updatedAt = now;
        updated = { ...target };
      }
    });

    if (!updated) {
      throw new AppError('Table booking not found.', 404);
    }

    db.logAudit(
      'BOOKING_STATUS_CHANGED',
      actor,
      `Booking #${(updated as TableBooking).bookingRef || bookingId} status updated to ${status}${allocatedTable ? ` (Table: ${allocatedTable})` : ''}`
    );
    return updated;
  },
};
