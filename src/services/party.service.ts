import { AppError } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';
import { logAudit } from '@/lib/audit';
import { escapeRegex } from '@/lib/regex';
import { IPartyInquiry, PartyInquiryModel } from '@/models/PartyInquiry.model';
import { cleanDoc, cleanDocs } from '@/models/_schema';

export const partyService = {
  async createInquiry(data: any) {
    const {
      customerName,
      phone,
      email,
      eventType,
      preferredDate,
      guestCount,
      budgetRange,
      specialRequirements,
    } = data;

    if (!customerName || !phone || !preferredDate || !guestCount) {
      throw new AppError(
        'Name, phone, preferred event date, and estimated guest count are required.',
        400
      );
    }

    await connectDB();
    const now = new Date().toISOString();
    const id = `pty_${Date.now()}`;

    const newParty: IPartyInquiry = {
      id,
      customerName: String(customerName).trim(),
      phone: String(phone).trim(),
      email: email ? String(email).trim() : undefined,
      eventType: [
        'birthday',
        'anniversary',
        'corporate',
        'family_gathering',
        'other',
      ].includes(eventType)
        ? eventType
        : 'other',
      preferredDate: String(preferredDate).trim(),
      guestCount: Math.max(1, parseInt(guestCount, 10) || 10),
      budgetRange: budgetRange ? String(budgetRange).trim() : undefined,
      specialRequirements: specialRequirements
        ? String(specialRequirements).trim()
        : undefined,
      status: 'new',
      staffNotes: '',
      createdAt: now,
      updatedAt: now,
    };

    await PartyInquiryModel.create(newParty);
    await logAudit(
      'PARTY_INQUIRY_CREATED',
      'Public Customer',
      `Party inquiry #${id} for ${guestCount} guests on ${preferredDate}`
    );

    return { inquiryId: id, inquiry: newParty };
  },

  async getAdminInquiries(query: any) {
    await connectDB();
    const { search, status, eventType, page = '1', limit = '20' } = query;

    const filter: Record<string, any> = {};
    if (search) {
      const rx = new RegExp(escapeRegex(String(search)), 'i');
      filter.$or = [{ customerName: rx }, { phone: rx }, { email: rx }];
    }
    if (status && status !== 'all') filter.status = status;
    if (eventType && eventType !== 'all') filter.eventType = eventType;

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [total, rawInquiries] = await Promise.all([
      PartyInquiryModel.countDocuments(filter),
      PartyInquiryModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return {
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      inquiries: cleanDocs<IPartyInquiry>(rawInquiries),
    };
  },

  async updateInquiryStatus(
    inquiryId: string,
    payload: { status?: string; staffNotes?: string; followUpDate?: string },
    actor = 'Staff'
  ) {
    await connectDB();
    const { status, staffNotes, followUpDate } = payload;

    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (status) updates.status = status;
    if (staffNotes !== undefined) updates.staffNotes = String(staffNotes).trim();
    if (followUpDate !== undefined) updates.followUpDate = String(followUpDate).trim();

    const updated = await PartyInquiryModel.findOneAndUpdate(
      { id: inquiryId },
      { $set: updates },
      { new: true }
    ).lean();

    if (!updated) {
      throw new AppError('Party inquiry not found.', 404);
    }

    await logAudit(
      'PARTY_INQUIRY_STATUS_CHANGED',
      actor,
      `Party inquiry #${inquiryId} updated to ${status}`
    );
    return cleanDoc<IPartyInquiry>(updated);
  },
};
