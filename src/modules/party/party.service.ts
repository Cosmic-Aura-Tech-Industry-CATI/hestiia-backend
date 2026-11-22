import mongoose from 'mongoose';
import { PartyInquiry, type IPartyInquiryDocument } from './party.model.js';
import { db } from '../../shared/config/store.js';
import { AppError } from '../../shared/utils/appError.js';

const VALID_STATUSES = ['new', 'contacted', 'quoted', 'confirmed', 'cancelled'] as const;
const VALID_EVENT_TYPES = ['birthday', 'anniversary', 'corporate', 'family_gathering', 'other'] as const;

export const partyService = {
  /**
   * Helper to format party inquiry document
   */
  formatInquiry(doc: any) {
    const id = doc?._id ? doc._id.toString() : (doc?.id || '');
    return {
      id,
      _id: doc?._id || id,
      customerName: doc?.customerName || '',
      phone: doc?.phone || '',
      email: doc?.email || undefined,
      eventType: doc?.eventType || 'other',
      preferredDate: doc?.preferredDate || '',
      guestCount: doc?.guestCount ?? 10,
      budgetRange: doc?.budgetRange || undefined,
      specialRequirements: doc?.specialRequirements || undefined,
      status: doc?.status || 'new',
      staffNotes: doc?.staffNotes || '',
      followUpDate: doc?.followUpDate || undefined,
      createdAt: doc?.createdAt || new Date(),
      updatedAt: doc?.updatedAt || new Date(),
    };
  },

  /**
   * Fast lookup helper
   */
  async findInquiryDoc(idOrPhone: string) {
    if (mongoose.Types.ObjectId.isValid(idOrPhone)) {
      const byId = await PartyInquiry.findById(idOrPhone);
      if (byId) return byId;
    }
    return PartyInquiry.findOne({
      $or: [
        { phone: idOrPhone.trim() },
        { _id: mongoose.Types.ObjectId.isValid(idOrPhone) ? idOrPhone : undefined },
      ].filter(Boolean),
    });
  },

  /**
   * 1. Public Banquet / Party Inquiry Submission
   */
  async createInquiry(data: any) {
    const { customerName, phone, email, eventType, preferredDate, guestCount, budgetRange, specialRequirements } = data;

    if (!customerName || !phone || !preferredDate || !guestCount) {
      throw new AppError('Name, phone, preferred event date, and estimated guest count are required.', 400);
    }

    const cleanEventType = VALID_EVENT_TYPES.includes(eventType) ? eventType : 'other';
    const numGuests = Math.max(1, parseInt(String(guestCount), 10) || 10);

    const created = await PartyInquiry.create({
      customerName: String(customerName).trim(),
      phone: String(phone).trim(),
      email: email ? String(email).trim().toLowerCase() : '',
      eventType: cleanEventType,
      preferredDate: String(preferredDate).trim(),
      guestCount: numGuests,
      budgetRange: budgetRange ? String(budgetRange).trim() : '',
      specialRequirements: specialRequirements ? String(specialRequirements).trim() : '',
      status: 'new',
      staffNotes: '',
      followUpDate: '',
    });

    const formatted = this.formatInquiry(created.toJSON());

    // Synchronize in-memory state for legacy compatibility
    db.updateState((s) => s.partyInquiries.unshift(formatted as any));
    db.logAudit('PARTY_INQUIRY_CREATED', 'Public Customer', `Party inquiry #${formatted.id} for ${numGuests} guests on ${preferredDate}`);

    return { inquiryId: formatted.id, inquiry: formatted };
  },

  /**
   * 2. Admin Inquiry Listing (Optimized query with multi-filter & pagination)
   */
  async getAdminInquiries(query: any) {
    const { search, status, eventType, page = '1', limit = '20' } = query;

    const filter: any = {};

    if (search && String(search).trim()) {
      const q = String(search).trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      filter.$or = [
        { customerName: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { staffNotes: { $regex: q, $options: 'i' } },
      ];
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (eventType && eventType !== 'all') {
      filter.eventType = eventType;
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, inquiries] = await Promise.all([
      PartyInquiry.countDocuments(filter),
      PartyInquiry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return {
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      inquiries: inquiries.map((p) => this.formatInquiry(p)),
    };
  },

  /**
   * 3. Get Single Inquiry By ID
   */
  async getInquiryById(id: string) {
    const doc = await this.findInquiryDoc(id);
    if (!doc) {
      throw new AppError('Party inquiry not found.', 404);
    }
    return this.formatInquiry(doc);
  },

  /**
   * 4. Update Inquiry Status & Staff Follow-up Notes
   */
  async updateInquiryStatus(inquiryId: string, payload: { status?: string; staffNotes?: string; followUpDate?: string }, actor = 'Staff') {
    const { status, staffNotes, followUpDate } = payload;

    const doc = await this.findInquiryDoc(inquiryId);
    if (!doc) {
      throw new AppError('Party inquiry not found.', 404);
    }

    const updateFields: any = {};

    if (status) {
      if (!VALID_STATUSES.includes(status as any)) {
        throw new AppError(`Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}`, 400);
      }
      updateFields.status = status;
    }

    if (staffNotes !== undefined) {
      updateFields.staffNotes = String(staffNotes).trim();
    }

    if (followUpDate !== undefined) {
      updateFields.followUpDate = String(followUpDate).trim();
    }

    const updated = await PartyInquiry.findByIdAndUpdate(
      doc._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      throw new AppError('Failed to update party inquiry.', 500);
    }

    const formatted = this.formatInquiry(updated);

    // Sync in-memory store
    db.updateState((s) => {
      const target = s.partyInquiries.find((p) => p.id === formatted.id);
      if (target) {
        if (status) target.status = status as any;
        if (staffNotes !== undefined) target.staffNotes = String(staffNotes).trim();
        if (followUpDate !== undefined) target.followUpDate = String(followUpDate).trim();
        target.updatedAt = new Date().toISOString();
      }
    });

    db.logAudit('PARTY_INQUIRY_STATUS_CHANGED', actor, `Party inquiry #${formatted.id} updated to ${status || 'edited'}`);
    return formatted;
  },

  /**
   * 5. Delete Party Inquiry
   */
  async deleteInquiry(id: string, actor = 'Staff') {
    const doc = await this.findInquiryDoc(id);
    if (!doc) {
      throw new AppError('Party inquiry not found.', 404);
    }

    await PartyInquiry.findByIdAndDelete(doc._id).lean();

    // Sync in-memory store
    db.updateState((s) => {
      s.partyInquiries = s.partyInquiries.filter((p) => p.id !== doc._id.toString());
    });

    db.logAudit('PARTY_INQUIRY_DELETED', actor, `Party inquiry #${doc._id} removed`);
    return { id: doc._id.toString(), message: 'Party inquiry deleted successfully.' };
  },
};
