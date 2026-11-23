import mongoose from 'mongoose';
import { Booking, type IBookingDocument } from './booking.model.js';
import { Customer } from '../customers/customer.model.js';
import { db } from '../../shared/config/store.js';
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
  /**
   * Helper to format booking document for clean API response
   */
  formatBooking(doc: any) {
    const id = doc?._id ? doc._id.toString() : (doc?.id || '');
    return {
      id,
      _id: doc?._id || id,
      bookingRef: doc?.bookingRef || '',
      customerName: doc?.customerName || '',
      phone: doc?.phone || '',
      email: doc?.email || undefined,
      date: doc?.date || '',
      time: doc?.time || '',
      guests: doc?.guests || '2 Guests',
      occasion: doc?.occasion || 'Dining',
      specialRequests: doc?.specialRequests || undefined,
      status: doc?.status || 'new',
      allocatedTable: doc?.allocatedTable || undefined,
      staffNotes: doc?.staffNotes || '',
      confirmationMethod: doc?.confirmationMethod || 'on-screen',
      holdPolicy: doc?.holdPolicy || RESTAURANT_PROFILE.holdPolicy,
      confirmedAt: doc?.confirmedAt || undefined,
      createdAt: doc?.createdAt || new Date(),
      updatedAt: doc?.updatedAt || new Date(),
    };
  },

  /**
   * Lookup helper: by ObjectId or bookingRef
   */
  async findBookingDoc(idOrRef: string) {
    const clean = idOrRef.trim();
    if (mongoose.Types.ObjectId.isValid(clean)) {
      const byId = await Booking.findById(clean);
      if (byId) return byId;
    }
    return Booking.findOne({
      $or: [
        { bookingRef: clean.toUpperCase() },
        { phone: clean },
      ],
    });
  },

  /**
   * 1. Public Table Reservation Request (Persists in MongoDB Atlas)
   */
  async createBooking(data: CreateBookingDTO) {
    const name = (data.name || data.customerName || '')?.trim();
    const phone = (data.phone || '')?.trim();
    const email = data.email ? String(data.email).trim().toLowerCase() : '';
    const date = (data.date || '')?.trim();
    const time = (data.time || '')?.trim();
    const guests = data.guests ? String(data.guests).trim() : '2 Guests';
    const occasion = data.occasion ? String(data.occasion).trim() : 'Dining';
    const requests = (data.requests || data.specialRequests) ? String(data.requests || data.specialRequests).trim() : '';

    if (!name || !phone || !date || !time) {
      throw new AppError('Name, phone number, date, and preferred time slot are required.', 400);
    }

    // Auto-generate unique booking reference
    let bookingRef = generateBookingRef(date);
    while (await Booking.findOne({ bookingRef }).select('_id').lean()) {
      bookingRef = generateBookingRef(date);
    }

    const created = await Booking.create({
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
      confirmationMethod: 'on-screen',
    });

    const formatted = this.formatBooking(created.toJSON());

    // Synchronize customer profile directly in MongoDB Atlas
    Customer.findOneAndUpdate(
      {
        $or: [{ phone }, { phone: phone.replace(/\D/g, '') }],
      },
      {
        $setOnInsert: {
          name,
          phone,
          email: email || '',
          createdAt: new Date(),
        },
      },
      { upsert: true }
    ).catch(() => {});

    // Sync in-memory store for backward compatibility
    db.updateState((s) => s.bookings.unshift(formatted as any));
    db.logAudit('TABLE_BOOKING_REQUESTED', 'Public Customer', `Reservation inquiry #${bookingRef} by ${name} for ${date} ${time}`);

    const confirmation: BookingConfirmationDTO = {
      id: formatted.id,
      bookingRef,
      customerName: name,
      phone,
      email: email || undefined,
      date,
      time,
      guests,
      occasion,
      specialRequests: requests || undefined,
      status: 'new',
      allocatedTable: undefined,
      holdPolicy: RESTAURANT_PROFILE.holdPolicy,
      restaurantDetails: RESTAURANT_PROFILE,
      createdAt: formatted.createdAt.toString(),
    };

    return { bookingId: formatted.id, bookingRef, booking: formatted, confirmation };
  },

  /**
   * 2. Public Reservation Lookup & Verification Voucher (Optimized lean query)
   */
  async getBookingByRef(ref: string): Promise<BookingConfirmationDTO> {
    const cleanRef = String(ref || '').trim();
    let found: any = null;

    if (mongoose.Types.ObjectId.isValid(cleanRef)) {
      found = await Booking.findById(cleanRef).lean();
    }

    if (!found) {
      found = await Booking.findOne({
        bookingRef: cleanRef.toUpperCase(),
      }).lean();
    }

    if (!found) {
      throw new AppError('Booking confirmation not found with reference: ' + ref, 404);
    }

    return {
      id: found._id.toString(),
      bookingRef: found.bookingRef || `HST-TB-RES-${found._id.toString().slice(-4)}`,
      customerName: found.customerName,
      phone: found.phone,
      email: found.email || undefined,
      date: found.date,
      time: found.time,
      guests: found.guests,
      occasion: found.occasion,
      specialRequests: found.specialRequests || undefined,
      status: found.status,
      allocatedTable: found.allocatedTable || undefined,
      holdPolicy: found.holdPolicy || RESTAURANT_PROFILE.holdPolicy,
      restaurantDetails: RESTAURANT_PROFILE,
      confirmedAt: found.confirmedAt ? found.confirmedAt.toISOString() : undefined,
      createdAt: found.createdAt.toISOString(),
    };
  },

  /**
   * 3. Admin Bookings Listing (Optimized query with pagination, search, and filtering)
   */
  async getAdminBookings(query: any) {
    const { search, status, date, page = '1', limit = '20' } = query;

    const filter: any = {};

    if (search && String(search).trim()) {
      const q = String(search).trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      filter.$or = [
        { customerName: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { bookingRef: { $regex: q, $options: 'i' } },
        { allocatedTable: { $regex: q, $options: 'i' } },
        { staffNotes: { $regex: q, $options: 'i' } },
      ];
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (date && String(date).trim()) {
      filter.date = String(date).trim();
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return {
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      bookings: bookings.map((b) => this.formatBooking(b)),
    };
  },

  /**
   * 4. Single Booking Details by ID
   */
  async getBookingById(id: string) {
    const doc = await this.findBookingDoc(id);
    if (!doc) {
      throw new AppError('Table booking not found.', 404);
    }
    return this.formatBooking(doc);
  },

  /**
   * 5. Update Booking Status, Allocated Table, & Staff Notes
   */
  async updateBookingStatus(bookingId: string, payload: UpdateBookingStatusDTO, actor = 'Staff') {
    const { status, staffNotes, allocatedTable, confirmationMethod } = payload;

    const doc = await this.findBookingDoc(bookingId);
    if (!doc) {
      throw new AppError('Table booking not found.', 404);
    }

    const updateFields: any = {};

    if (status) {
      updateFields.status = status;
      if (status === 'confirmed' && !doc.confirmedAt) {
        updateFields.confirmedAt = new Date();
      }
    }

    if (staffNotes !== undefined) {
      updateFields.staffNotes = String(staffNotes).trim();
    }

    if (allocatedTable !== undefined) {
      updateFields.allocatedTable = String(allocatedTable).trim();
    }

    if (confirmationMethod !== undefined) {
      updateFields.confirmationMethod = confirmationMethod;
    }

    const updated = await Booking.findByIdAndUpdate(
      doc._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      throw new AppError('Failed to update table booking.', 500);
    }

    const formatted = this.formatBooking(updated);

    // Sync in-memory store
    db.updateState((s) => {
      const target = s.bookings.find((b) => b.id === formatted.id || b.bookingRef === formatted.bookingRef);
      if (target) {
        if (status) target.status = status as any;
        if (staffNotes !== undefined) target.staffNotes = String(staffNotes).trim();
        if (allocatedTable !== undefined) target.allocatedTable = String(allocatedTable).trim();
        if (confirmationMethod !== undefined) target.confirmationMethod = confirmationMethod;
        target.updatedAt = new Date().toISOString();
      }
    });

    db.logAudit(
      'BOOKING_STATUS_CHANGED',
      actor,
      `Booking #${formatted.bookingRef} status updated to ${status}${allocatedTable ? ` (Table: ${allocatedTable})` : ''}`
    );

    return formatted;
  },

  /**
   * 6. Delete Table Booking
   */
  async deleteBooking(bookingId: string, actor = 'Staff') {
    const doc = await this.findBookingDoc(bookingId);
    if (!doc) {
      throw new AppError('Table booking not found.', 404);
    }

    await Booking.findByIdAndDelete(doc._id).lean();

    // Sync in-memory store
    db.updateState((s) => {
      s.bookings = s.bookings.filter((b) => b.id !== doc._id.toString() && b.bookingRef !== doc.bookingRef);
    });

    db.logAudit('BOOKING_DELETED', actor, `Booking #${doc.bookingRef} was removed`);
    return { id: doc._id.toString(), bookingRef: doc.bookingRef, message: 'Booking removed successfully.' };
  },
};
