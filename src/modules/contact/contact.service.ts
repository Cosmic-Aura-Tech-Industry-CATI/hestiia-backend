import mongoose from 'mongoose';
import { db } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';
import { ContactSettings } from './contact.model.js';
import {
  IContactSettings,
  IUpdateContactDTO,
  ICustomerContactResponse,
} from './contact.interface.js';
import { validateUpdateContactPayload } from './contact.validator.js';

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
};

export default contactService;
