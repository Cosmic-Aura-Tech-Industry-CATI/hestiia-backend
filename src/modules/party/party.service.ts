import { db, PartyInquiry } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';

export const partyService = {
  async createInquiry(data: any) {
    const { customerName, phone, email, eventType, preferredDate, guestCount, budgetRange, specialRequirements } = data;

    if (!customerName || !phone || !preferredDate || !guestCount) {
      throw new AppError('Name, phone, preferred event date, and estimated guest count are required.', 400);
    }

    const now = new Date().toISOString();
    const id = 'pty_' + Date.now();

    const newParty: PartyInquiry = {
      id,
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : undefined,
      eventType: ['birthday', 'anniversary', 'corporate', 'family_gathering', 'other'].includes(eventType)
        ? eventType
        : 'other',
      preferredDate: String(preferredDate).trim(),
      guestCount: Math.max(1, parseInt(guestCount, 10) || 10),
      budgetRange: budgetRange ? String(budgetRange).trim() : undefined,
      specialRequirements: specialRequirements ? String(specialRequirements).trim() : undefined,
      status: 'new',
      staffNotes: '',
      createdAt: now,
      updatedAt: now,
    };

    db.updateState((s) => s.partyInquiries.unshift(newParty));
    db.logAudit('PARTY_INQUIRY_CREATED', 'Public Customer', `Party inquiry #${id} for ${guestCount} guests on ${preferredDate}`);

    return { inquiryId: id, inquiry: newParty };
  },

  async getAdminInquiries(query: any) {
    const { search, status, eventType, page = '1', limit = '20' } = query;
    let inquiries = [...db.getState().partyInquiries];

    if (search) {
      const q = String(search).toLowerCase();
      inquiries = inquiries.filter(
        (p) =>
          p.customerName.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          (p.email && p.email.toLowerCase().includes(q))
      );
    }

    if (status && status !== 'all') {
      inquiries = inquiries.filter((p) => p.status === status);
    }

    if (eventType && eventType !== 'all') {
      inquiries = inquiries.filter((p) => p.eventType === eventType);
    }

    inquiries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = inquiries.slice(startIndex, startIndex + limitNum);

    return {
      total: inquiries.length,
      page: pageNum,
      totalPages: Math.ceil(inquiries.length / limitNum),
      inquiries: paginated,
    };
  },

  async updateInquiryStatus(inquiryId: string, payload: { status?: string; staffNotes?: string; followUpDate?: string }, actor = 'Staff') {
    const { status, staffNotes, followUpDate } = payload;
    let updated: PartyInquiry | null = null;

    db.updateState((s) => {
      const target = s.partyInquiries.find((p) => p.id === inquiryId);
      if (target) {
        if (status) target.status = status as any;
        if (staffNotes !== undefined) target.staffNotes = String(staffNotes).trim();
        if (followUpDate !== undefined) target.followUpDate = String(followUpDate).trim();
        target.updatedAt = new Date().toISOString();
        updated = { ...target };
      }
    });

    if (!updated) {
      throw new AppError('Party inquiry not found.', 404);
    }

    db.logAudit('PARTY_INQUIRY_STATUS_CHANGED', actor, `Party inquiry #${inquiryId} updated to ${status}`);
    return updated;
  },
};
