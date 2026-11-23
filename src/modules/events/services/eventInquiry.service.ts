import mongoose from 'mongoose';
import { db } from '../../../shared/config/db.js';
import { AppError } from '../../../shared/utils/appError.js';
import { EventInquiry } from '../models/eventInquiry.model.js';
import { bookingsService } from '../../bookings/bookings.service.js';
import { IEventInquiry, EventInquiryStatus } from '../interfaces/events.interface.js';

export const eventInquiryService = {
  /**
   * Submit an event booking / inquiry request (Customer facing)
   */
  async createInquiry(data: Partial<IEventInquiry>): Promise<IEventInquiry> {
    const customer_name = (data.customer_name || '')?.trim();
    const phone = (data.phone || '')?.trim();
    const email = data.email ? String(data.email).trim().toLowerCase() : undefined;
    const event_type = (data.event_type || 'Private Event')?.trim();
    const expected_attendees = Number(data.expected_attendees);
    const requirements = (data.requirements || '')?.trim();
    const message = (data.message || '')?.trim();

    if (!customer_name) {
      throw new AppError('Customer name is required.', 400);
    }
    if (!phone || phone.length < 10) {
      throw new AppError('A valid contact phone number (at least 10 digits) is required.', 400);
    }
    if (!data.preferred_date) {
      throw new AppError('Preferred event date is required.', 400);
    }
    const preferred_date = new Date(data.preferred_date);
    if (isNaN(preferred_date.getTime())) {
      throw new AppError('Invalid preferred event date.', 400);
    }
    if (isNaN(expected_attendees) || expected_attendees < 1) {
      throw new AppError('Expected attendees must be a positive number of at least 1.', 400);
    }

    const now = new Date().toISOString();
    const inquiryRecord: IEventInquiry = {
      id: 'inq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      customer_name,
      phone,
      email,
      event_type,
      preferred_date: preferred_date.toISOString(),
      expected_attendees,
      requirements,
      message,
      status: 'pending',
      admin_notes: '',
      createdAt: now,
      updatedAt: now,
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await EventInquiry.create({
          customer_name: inquiryRecord.customer_name,
          phone: inquiryRecord.phone,
          email: inquiryRecord.email,
          event_type: inquiryRecord.event_type,
          preferred_date: preferred_date,
          expected_attendees: inquiryRecord.expected_attendees,
          requirements: inquiryRecord.requirements,
          message: inquiryRecord.message,
          status: inquiryRecord.status,
          admin_notes: '',
        });
        inquiryRecord.id = String(doc._id);
      } catch (err: any) {
        console.warn('[EventInquiry] Mongoose create failed, using local store:', err?.message);
      }
    }

    db.updateState((s: any) => {
      if (!s.eventInquiries) s.eventInquiries = [];
      s.eventInquiries.unshift(inquiryRecord);
    });

    db.logAudit(
      'EVENT_INQUIRY_RECEIVED',
      'Public Customer',
      `Event inquiry submitted by ${customer_name} (${phone}) for ${event_type} on ${preferred_date.toISOString().split('T')[0]}`
    );

    return inquiryRecord;
  },

  /**
   * Retrieve event inquiries for Admin Dashboard (with filtering and pagination)
   */
  async getAdminInquiries(query: any = {}): Promise<{ inquiries: IEventInquiry[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20));
    const status = query.status ? String(query.status).trim().toLowerCase() : '';
    const search = query.search ? String(query.search).trim().toLowerCase() : '';
    const startDate = query.startDate ? new Date(query.startDate) : null;
    const endDate = query.endDate ? new Date(query.endDate) : null;

    let matched: IEventInquiry[] = [];
    let total = 0;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (status && status !== 'all') {
          filter.status = status;
        }
        if (search) {
          filter.$or = [
            { customer_name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { event_type: { $regex: search, $options: 'i' } },
          ];
        }
        if (startDate || endDate) {
          filter.preferred_date = {};
          if (startDate && !isNaN(startDate.getTime())) filter.preferred_date.$gte = startDate;
          if (endDate && !isNaN(endDate.getTime())) filter.preferred_date.$lte = endDate;
        }

        total = await EventInquiry.countDocuments(filter);
        const docs = await EventInquiry.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();

        matched = docs.map((d: any) => ({
          id: String(d._id),
          customer_name: d.customer_name,
          phone: d.phone,
          email: d.email,
          event_type: d.event_type,
          preferred_date: d.preferred_date,
          expected_attendees: d.expected_attendees,
          requirements: d.requirements,
          message: d.message,
          status: d.status,
          admin_notes: d.admin_notes,
          booking_id: d.booking_id,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }));
      } catch {
        // fallback
      }
    }

    if (matched.length === 0 && total === 0) {
      const state = db.getState() as any;
      let all: IEventInquiry[] = state.eventInquiries || [];

      if (status && status !== 'all') {
        all = all.filter((i) => i.status === status);
      }
      if (search) {
        all = all.filter((i) =>
          i.customer_name.toLowerCase().includes(search) ||
          i.phone.toLowerCase().includes(search) ||
          i.event_type.toLowerCase().includes(search)
        );
      }
      if (startDate && !isNaN(startDate.getTime())) {
        all = all.filter((i) => new Date(i.preferred_date).getTime() >= startDate.getTime());
      }
      if (endDate && !isNaN(endDate.getTime())) {
        all = all.filter((i) => new Date(i.preferred_date).getTime() <= endDate.getTime());
      }

      all.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      total = all.length;
      matched = all.slice((page - 1) * limit, page * limit);
    }

    return { inquiries: matched, total, page, limit };
  },

  /**
   * Retrieve single event inquiry by ID for Admin Dashboard
   */
  async getAdminInquiryById(id: string): Promise<IEventInquiry> {
    const inquiry = await this.findInquiryRecord(id);
    if (!inquiry) {
      throw new AppError('Event inquiry not found.', 404);
    }
    return inquiry;
  },

  /**
   * Update inquiry status & synchronize with table bookings if confirmed
   */
  async updateInquiryStatus(
    id: string,
    status: EventInquiryStatus,
    username = 'admin',
    extra?: { timeSlot?: string }
  ): Promise<IEventInquiry> {
    const validStatuses: EventInquiryStatus[] = ['pending', 'contacted', 'confirmed', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const inquiry = await this.findInquiryRecord(id);
    if (!inquiry) {
      throw new AppError('Event inquiry not found.', 404);
    }

    let booking_id = inquiry.booking_id;

    // When confirmed and not yet linked to table booking, link to bookingsService
    if (status === 'confirmed' && !booking_id) {
      try {
        const preferredDateStr = new Date(inquiry.preferred_date).toISOString().split('T')[0];
        const bookingResult = await bookingsService.createBooking({
          name: inquiry.customer_name,
          phone: inquiry.phone,
          email: inquiry.email,
          date: preferredDateStr,
          time: extra?.timeSlot || '19:00',
          guests: `${inquiry.expected_attendees} Guests`,
          occasion: inquiry.event_type,
          requests: [inquiry.requirements, inquiry.message].filter(Boolean).join(' | '),
        });
        if (bookingResult?.booking?.id) {
          booking_id = bookingResult.booking.id;
        }
      } catch (err: any) {
        console.warn('[EventInquiry] Booking synchronization notice:', err?.message);
      }
    }

    const now = new Date().toISOString();

    if (mongoose.connection.readyState === 1) {
      try {
        const updatePayload: any = { status, updatedAt: now };
        if (booking_id) updatePayload.booking_id = booking_id;
        await EventInquiry.findByIdAndUpdate(inquiry.id, { $set: updatePayload });
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.eventInquiries) {
        const item = s.eventInquiries.find((i: any) => i.id === id || i._id === id);
        if (item) {
          item.status = status;
          item.updatedAt = now;
          if (booking_id) item.booking_id = booking_id;
        }
      }
    });

    inquiry.status = status;
    inquiry.updatedAt = now;
    if (booking_id) inquiry.booking_id = booking_id;

    db.logAudit(
      'EVENT_INQUIRY_STATUS_CHANGED',
      username,
      `Updated event inquiry #${id} status to ${status.toUpperCase()}${booking_id ? ` (Linked Booking: ${booking_id})` : ''}`
    );

    return inquiry;
  },

  /**
   * Update internal admin notes for an inquiry
   */
  async updateAdminNotes(id: string, admin_notes: string, username = 'admin'): Promise<IEventInquiry> {
    const inquiry = await this.findInquiryRecord(id);
    if (!inquiry) {
      throw new AppError('Event inquiry not found.', 404);
    }

    const notes = String(admin_notes ?? '').trim();
    const now = new Date().toISOString();

    if (mongoose.connection.readyState === 1) {
      try {
        await EventInquiry.findByIdAndUpdate(inquiry.id, { $set: { admin_notes: notes, updatedAt: now } });
      } catch {
        // fallback
      }
    }

    db.updateState((s: any) => {
      if (s.eventInquiries) {
        const item = s.eventInquiries.find((i: any) => i.id === id || i._id === id);
        if (item) {
          item.admin_notes = notes;
          item.updatedAt = now;
        }
      }
    });

    inquiry.admin_notes = notes;
    inquiry.updatedAt = now;

    db.logAudit('EVENT_INQUIRY_NOTES_UPDATED', username, `Updated staff notes for event inquiry #${id}`);
    return inquiry;
  },

  /**
   * Helper: Find inquiry across Mongoose or local store
   */
  async findInquiryRecord(id: string): Promise<IEventInquiry | null> {
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await EventInquiry.findById(id).lean();
        if (doc) {
          return {
            id: String(doc._id),
            customer_name: doc.customer_name,
            phone: doc.phone,
            email: doc.email,
            event_type: doc.event_type,
            preferred_date: doc.preferred_date,
            expected_attendees: doc.expected_attendees,
            requirements: doc.requirements,
            message: doc.message,
            status: doc.status,
            admin_notes: doc.admin_notes,
            booking_id: doc.booking_id,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          };
        }
      } catch {
        // fallback
      }
    }

    const state = db.getState() as any;
    const inquiries: IEventInquiry[] = state.eventInquiries || [];
    return inquiries.find((i: any) => i.id === id || i._id === id) || null;
  },
};

export default eventInquiryService;
