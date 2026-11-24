import mongoose from 'mongoose';
import { db } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';
import { ContactSettings, Contact, type IContactDocument } from './contact.model.js';
import {
  IContactSettings,
  IUpdateContactDTO,
  ICustomerContactResponse,
  IContactInquiry,
  ContactStatus,
  ContactFilterQuery,
} from './contact.interface.js';
import { validateUpdateContactPayload } from './contact.validator.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/index.js';
import { jobQueue } from '../../jobs/jobQueue.js';

export interface ContactStoreItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: ContactStatus;
  responseNotes: string;
  respondedAt?: string;
  respondedBy?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  updatedAt: string;
}

const contactStore: ContactStoreItem[] = [];

export const DEFAULT_CONTACT_SETTINGS: IContactSettings = {
  phone: {
    number: '+919876543210',
    enabled: true,
  },
  email: {
    address: 'restaurant@hestiia.com',
    enabled: true,
  },
  whatsapp: {
    number: '919876543210',
    enabled: true,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const contactService = {
  /**
   * Format settings for admin responses
   */
  formatAdminSettings(doc: any): IContactSettings {
    const id = doc._id ? doc._id.toString() : (doc.id || 'contact_settings_singleton');
    return {
      _id: id,
      id,
      phone: {
        number: doc.phone?.number || '',
        enabled: Boolean(doc.phone?.enabled),
      },
      email: {
        address: doc.email?.address || '',
        enabled: Boolean(doc.email?.enabled),
      },
      whatsapp: {
        number: doc.whatsapp?.number || '',
        enabled: Boolean(doc.whatsapp?.enabled),
      },
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: doc.updatedAt || new Date().toISOString(),
    };
  },

  /**
   * API 2: Admin - Get Contact Settings (Single configuration document)
   */
  async getAdminSettings(): Promise<IContactSettings> {
    if (mongoose.connection.readyState === 1) {
      try {
        let doc = await ContactSettings.findOne().lean();
        if (!doc) {
          doc = await ContactSettings.create({
            phone: { ...DEFAULT_CONTACT_SETTINGS.phone },
            email: { ...DEFAULT_CONTACT_SETTINGS.email },
            whatsapp: { ...DEFAULT_CONTACT_SETTINGS.whatsapp },
          });
        }
        if (doc) {
          return this.formatAdminSettings(doc);
        }
      } catch (err: any) {
        console.warn('[ContactService] MongoDB findOne failed, using persistent store:', err?.message);
      }
    }

    const state = db.getState() as any;
    if (!state.contactSettings) {
      db.updateState((s: any) => {
        s.contactSettings = {
          ...DEFAULT_CONTACT_SETTINGS,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
      return { ...DEFAULT_CONTACT_SETTINGS };
    }

    return this.formatAdminSettings(state.contactSettings);
  },

  /**
   * API 1: Customer - Get Contact Information (Public)
   * Returns ONLY enabled options with actionable frontend links
   */
  async getCustomerContact(): Promise<ICustomerContactResponse> {
    const settings = await this.getAdminSettings();

    const result: ICustomerContactResponse = {
      phone: null,
      email: null,
      whatsapp: null,
    };

    if (settings.phone?.enabled && settings.phone?.number && settings.phone.number.trim().length > 0) {
      const cleanPhone = settings.phone.number.trim();
      result.phone = {
        number: cleanPhone,
        action: `tel:${cleanPhone.replace(/\s+/g, '')}`,
      };
    }

    if (settings.email?.enabled && settings.email?.address && settings.email.address.trim().length > 0) {
      const cleanEmail = settings.email.address.trim().toLowerCase();
      result.email = {
        address: cleanEmail,
        action: `mailto:${cleanEmail}`,
      };
    }

    if (settings.whatsapp?.enabled && settings.whatsapp?.number && settings.whatsapp.number.trim().length > 0) {
      const rawWa = settings.whatsapp.number.trim();
      const cleanDigits = rawWa.replace(/\D/g, '');
      if (cleanDigits.length > 0) {
        result.whatsapp = {
          number: cleanDigits,
          action: `https://wa.me/${cleanDigits}`,
        };
      }
    }

    return result;
  },

  /**
   * API 3: Admin - Update Contact Settings
   * Atomically updates singleton configuration in MongoDB
   */
  async updateSettings(rawPayload: any, actor = 'admin'): Promise<IContactSettings> {
    const dto = validateUpdateContactPayload(rawPayload);
    const existing = await this.getAdminSettings();

    // Verify consistency: if an option is being enabled without providing a number, ensure existing number is valid
    if (dto.phone) {
      const willBeEnabled = dto.phone.enabled !== undefined ? dto.phone.enabled : existing.phone.enabled;
      const effectiveNumber = dto.phone.number !== undefined ? dto.phone.number : existing.phone.number;
      if (willBeEnabled && (!effectiveNumber || effectiveNumber.trim().length === 0)) {
        throw new AppError('Phone number is required when enabling phone contact option.', 400);
      }
    }

    if (dto.email) {
      const willBeEnabled = dto.email.enabled !== undefined ? dto.email.enabled : existing.email.enabled;
      const effectiveAddress = dto.email.address !== undefined ? dto.email.address : existing.email.address;
      if (willBeEnabled && (!effectiveAddress || effectiveAddress.trim().length === 0)) {
        throw new AppError('Email address is required when enabling email contact option.', 400);
      }
    }

    if (dto.whatsapp) {
      const willBeEnabled = dto.whatsapp.enabled !== undefined ? dto.whatsapp.enabled : existing.whatsapp.enabled;
      const effectiveNumber = dto.whatsapp.number !== undefined ? dto.whatsapp.number : existing.whatsapp.number;
      if (willBeEnabled && (!effectiveNumber || effectiveNumber.trim().length === 0)) {
        throw new AppError('WhatsApp number is required when enabling WhatsApp contact option.', 400);
      }
    }

    // Build update object
    const updateSet: any = {
      updatedAt: new Date(),
    };

    if (dto.phone) {
      if (dto.phone.number !== undefined) updateSet['phone.number'] = dto.phone.number;
      if (dto.phone.enabled !== undefined) updateSet['phone.enabled'] = dto.phone.enabled;
    }

    if (dto.email) {
      if (dto.email.address !== undefined) updateSet['email.address'] = dto.email.address;
      if (dto.email.enabled !== undefined) updateSet['email.enabled'] = dto.email.enabled;
    }

    if (dto.whatsapp) {
      if (dto.whatsapp.number !== undefined) updateSet['whatsapp.number'] = dto.whatsapp.number;
      if (dto.whatsapp.enabled !== undefined) updateSet['whatsapp.enabled'] = dto.whatsapp.enabled;
    }

    let updatedDoc: any = null;

    if (mongoose.connection.readyState === 1) {
      try {
        updatedDoc = await ContactSettings.findOneAndUpdate(
          {},
          { $set: updateSet },
          { upsert: true, returnDocument: 'after' }
        ).lean();
      } catch (err: any) {
        console.warn('[ContactService] MongoDB atomic update fallback:', err?.message);
      }
    }

    // Persist to local JSON database store
    const nowIso = new Date().toISOString();
    const updatedState: IContactSettings = {
      id: existing.id || 'contact_settings_singleton',
      phone: {
        number: dto.phone?.number !== undefined ? dto.phone.number : existing.phone.number,
        enabled: dto.phone?.enabled !== undefined ? dto.phone.enabled : existing.phone.enabled,
      },
      email: {
        address: dto.email?.address !== undefined ? dto.email.address : existing.email.address,
        enabled: dto.email?.enabled !== undefined ? dto.email.enabled : existing.email.enabled,
      },
      whatsapp: {
        number: dto.whatsapp?.number !== undefined ? dto.whatsapp.number : existing.whatsapp.number,
        enabled: dto.whatsapp?.enabled !== undefined ? dto.whatsapp.enabled : existing.whatsapp.enabled,
      },
      createdAt: existing.createdAt || nowIso,
      updatedAt: nowIso,
    };

    db.updateState((s: any) => {
      s.contactSettings = { ...updatedState };
    });

    db.logAudit('CONTACT_SETTINGS_UPDATED', actor, 'Updated restaurant contact configuration');

    return this.formatAdminSettings(updatedDoc || updatedState);
  },

  /**
   * Submit a new contact inquiry (Public Guest or Registered Customer)
   */
  async createInquiry(
    data: Partial<IContactInquiry>,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<any> {
    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const phone = String(data.phone || '').trim();
    const subject = String(data.subject || 'general').trim();
    const message = String(data.message || '').trim();

    if (!name) {
      throw new BadRequestError('Full name is required');
    }
    if (!email) {
      throw new BadRequestError('Email address is required');
    }
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestError('Invalid email address format');
    }
    if (!message) {
      throw new BadRequestError('Message text is required');
    }
    if (message.length > 2000) {
      throw new BadRequestError('Message exceeds maximum limit of 2000 characters');
    }

    const payload: Partial<IContactInquiry> = {
      name,
      email,
      phone,
      subject,
      message,
      status: 'new',
      responseNotes: '',
      ipAddress: meta?.ip || '',
      userAgent: meta?.userAgent || '',
    };

    let dbInquiry: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        dbInquiry = await Contact.create(payload);
      } catch (err: any) {
        console.warn(`[ContactService] MongoDB create failed: ${err?.message}`);
      }
    }

    const memoryItem: ContactStoreItem = {
      id: dbInquiry?._id ? String(dbInquiry._id) : 'cnt_' + Date.now(),
      name,
      email,
      phone,
      subject,
      message,
      status: 'new',
      responseNotes: '',
      ipAddress: meta?.ip || '',
      userAgent: meta?.userAgent || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    contactStore.unshift(memoryItem);

    // Dispatch background notification alert for management
    jobQueue.dispatch('ADMIN_CONTACT_ALERT', {
      inquiryId: memoryItem.id,
      name,
      email,
      subject,
      snippet: message.substring(0, 100),
    });

    return dbInquiry || memoryItem;
  },

  /**
   * Retrieve contact inquiries with filtering, search, and pagination
   */
  async getInquiries(query: ContactFilterQuery = {}): Promise<{
    inquiries: any[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    countsByStatus: Record<string, number>;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (query.status) {
          filter.status = query.status;
        }
        if (query.subject) {
          filter.subject = { $regex: new RegExp(query.subject, 'i') };
        }
        if (query.search) {
          const searchRegex = new RegExp(query.search.trim(), 'i');
          filter.$or = [
            { name: searchRegex },
            { email: searchRegex },
            { phone: searchRegex },
            { subject: searchRegex },
            { message: searchRegex },
          ];
        }

        const [inquiries, total, newCount, inProgressCount, respondedCount, archivedCount] =
          await Promise.all([
            Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Contact.countDocuments(filter),
            Contact.countDocuments({ status: 'new' }),
            Contact.countDocuments({ status: 'in_progress' }),
            Contact.countDocuments({ status: 'responded' }),
            Contact.countDocuments({ status: 'archived' }),
          ]);

        return {
          inquiries,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
          },
          countsByStatus: {
            total: newCount + inProgressCount + respondedCount + archivedCount,
            new: newCount,
            in_progress: inProgressCount,
            responded: respondedCount,
            archived: archivedCount,
          },
        };
      } catch (err: any) {
        console.warn(`[ContactService] MongoDB getInquiries failed: ${err?.message}`);
      }
    }

    // In-memory fallback
    let filtered = [...contactStore];
    if (query.status) {
      filtered = filtered.filter((i) => i.status === query.status);
    }
    if (query.subject) {
      filtered = filtered.filter((i) =>
        i.subject.toLowerCase().includes((query.subject as string).toLowerCase())
      );
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.email.toLowerCase().includes(q) ||
          i.subject.toLowerCase().includes(q) ||
          i.message.toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    return {
      inquiries: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      countsByStatus: {
        total: contactStore.length,
        new: contactStore.filter((i) => i.status === 'new').length,
        in_progress: contactStore.filter((i) => i.status === 'in_progress').length,
        responded: contactStore.filter((i) => i.status === 'responded').length,
        archived: contactStore.filter((i) => i.status === 'archived').length,
      },
    };
  },

  /**
   * Retrieve a single inquiry by its ID
   */
  async getInquiryById(id: string): Promise<any> {
    const cleanId = String(id || '').trim();
    if (!cleanId) {
      throw new BadRequestError('Inquiry ID is required');
    }

    if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(cleanId)) {
      try {
        const item = await Contact.findById(cleanId).lean();
        if (item) return item;
      } catch (err: any) {
        console.warn(`[ContactService] MongoDB findById failed: ${err?.message}`);
      }
    }

    const memoryItem = contactStore.find((i) => i.id === cleanId);
    if (!memoryItem) {
      throw new NotFoundError(`Contact inquiry #${cleanId} not found`);
    }
    return memoryItem;
  },

  /**
   * Update status or response notes for an inquiry
   */
  async updateInquiryStatus(
    id: string,
    updateData: { status?: ContactStatus; responseNotes?: string },
    user?: any
  ): Promise<any> {
    const cleanId = String(id || '').trim();
    if (!cleanId) {
      throw new BadRequestError('Inquiry ID is required');
    }

    const validStatuses: ContactStatus[] = ['new', 'in_progress', 'responded', 'archived'];
    if (updateData.status && !validStatuses.includes(updateData.status)) {
      throw new BadRequestError(`Invalid status. Allowed values: ${validStatuses.join(', ')}`);
    }

    const updateFields: any = { ...updateData };
    if (updateData.status === 'responded') {
      updateFields.respondedAt = new Date();
      updateFields.respondedBy = user?.name || user?.email || user?.id || 'Staff';
    }

    let updatedDoc: any = null;
    if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(cleanId)) {
      try {
        updatedDoc = await Contact.findByIdAndUpdate(cleanId, { $set: updateFields }, { new: true }).lean();
      } catch (err: any) {
        console.warn(`[ContactService] MongoDB update failed: ${err?.message}`);
      }
    }

    // In-memory fallback sync
    const memoryIdx = contactStore.findIndex((i) => i.id === cleanId);
    if (memoryIdx !== -1) {
      contactStore[memoryIdx] = {
        ...contactStore[memoryIdx],
        ...updateFields,
        updatedAt: new Date().toISOString(),
      };
      if (!updatedDoc) updatedDoc = contactStore[memoryIdx];
    }

    if (!updatedDoc) {
      throw new NotFoundError(`Contact inquiry #${cleanId} not found`);
    }

    return updatedDoc;
  },

  /**
   * Delete an inquiry (Superadmin Only)
   */
  async deleteInquiry(id: string): Promise<boolean> {
    const cleanId = String(id || '').trim();
    if (!cleanId) {
      throw new BadRequestError('Inquiry ID is required');
    }

    let deleted = false;
    if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(cleanId)) {
      try {
        const res = await Contact.findByIdAndDelete(cleanId);
        if (res) deleted = true;
      } catch (err: any) {
        console.warn(`[ContactService] MongoDB delete failed: ${err?.message}`);
      }
    }

    const memoryIdx = contactStore.findIndex((i) => i.id === cleanId);
    if (memoryIdx !== -1) {
      contactStore.splice(memoryIdx, 1);
      deleted = true;
    }

    if (!deleted) {
      throw new NotFoundError(`Contact inquiry #${cleanId} not found`);
    }

    return true;
  },

  /**
   * Get analytical overview of contact inquiries for admin dashboard
   */
  async getContactStats(): Promise<{
    total: number;
    new: number;
    in_progress: number;
    responded: number;
    archived: number;
    recentWeekCount: number;
  }> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    if (mongoose.connection.readyState === 1) {
      try {
        const [total, newCount, inProgressCount, respondedCount, archivedCount, recentWeekCount] =
          await Promise.all([
            Contact.countDocuments(),
            Contact.countDocuments({ status: 'new' }),
            Contact.countDocuments({ status: 'in_progress' }),
            Contact.countDocuments({ status: 'responded' }),
            Contact.countDocuments({ status: 'archived' }),
            Contact.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
          ]);

        return {
          total,
          new: newCount,
          in_progress: inProgressCount,
          responded: respondedCount,
          archived: archivedCount,
          recentWeekCount,
        };
      } catch (err: any) {
        console.warn(`[ContactService] MongoDB stats failed: ${err?.message}`);
      }
    }

    return {
      total: contactStore.length,
      new: contactStore.filter((i) => i.status === 'new').length,
      in_progress: contactStore.filter((i) => i.status === 'in_progress').length,
      responded: contactStore.filter((i) => i.status === 'responded').length,
      archived: contactStore.filter((i) => i.status === 'archived').length,
      recentWeekCount: contactStore.filter(
        (i) => new Date(i.createdAt).getTime() >= sevenDaysAgo.getTime()
      ).length,
    };
  },

  /**
   * Module health status
   */
  async getStatus() {
    return {
      module: 'contact',
      status: 'operational',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'fallback-store',
      timestamp: new Date().toISOString(),
    };
  },
};

export default contactService;
