import mongoose from 'mongoose';
import { db } from '../../shared/config/store.js';
import { Setting } from '../settings/setting.model.js';
import type {
  RestaurantDetails,
  RestaurantPublicProfile,
  RestaurantOperationalStatus,
  RestaurantUpdatePayload,
} from './restaurant.interface.js';

/**
 * Robust evaluation of opening hours against timezone
 */
function evaluateOpeningHours(
  openingHoursStr: string,
  timeZone = 'Asia/Kolkata'
): { isOpen: boolean; currentTimeStr: string; dayOfWeekStr: string } {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const dayOfWeekStr = parts.find((p) => p.type === 'weekday')?.value || 'Monday';
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    const currentMinutes = hour * 60 + minute;
    const currentTimeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    // Look for times in openingHoursStr e.g. "12:00 PM – 11:30 PM" or "11:30 AM – 11:30 PM"
    const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/gi;
    const matches = [...openingHoursStr.matchAll(timeRegex)];
    if (matches.length >= 2) {
      const parseMinutes = (hStr: string, mStr: string, meridiem: string) => {
        let h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        const isPM = meridiem.toUpperCase() === 'PM';
        if (isPM && h < 12) h += 12;
        if (!isPM && h === 12) h = 0;
        return h * 60 + m;
      };

      const openMinutes = parseMinutes(matches[0][1], matches[0][2], matches[0][3]);
      const closeMinutes = parseMinutes(matches[1][1], matches[1][2], matches[1][3]);

      if (closeMinutes > openMinutes) {
        const isOpen = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
        return { isOpen, currentTimeStr, dayOfWeekStr };
      } else {
        const isOpen = currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
        return { isOpen, currentTimeStr, dayOfWeekStr };
      }
    }
    return { isOpen: true, currentTimeStr, dayOfWeekStr };
  } catch {
    return { isOpen: true, currentTimeStr: '12:00', dayOfWeekStr: 'Today' };
  }
}

export const restaurantService = {
  /**
   * Retrieve complete restaurant settings from MongoDB Atlas with in-memory fallback
   */
  async getInfo(): Promise<RestaurantDetails> {
    if (mongoose.connection.readyState === 1) {
      try {
        let setting = await Setting.findOne().lean();
        if (!setting) {
          const defaultData = db.getState().settings;
          setting = (await Setting.create(defaultData)).toJSON() as any;
        }
        if (setting) return setting as unknown as RestaurantDetails;
      } catch { }
    }
    return db.getState().settings as unknown as RestaurantDetails;
  },

  /**
   * Public-facing brand & dining profile
   */
  async getPublicProfile(): Promise<RestaurantPublicProfile> {
    const s = await this.getInfo();
    return {
      restaurantName: s.restaurantName,
      tagline: s.tagline,
      eyebrow: s.eyebrow,
      description: s.description,
      address: s.address,
      phone: s.phone,
      whatsapp: s.whatsapp,
      email: s.email,
      openingHours: s.openingHours,
      timezone: s.timezone,
      currency: s.currency,
      currencySymbol: s.currencySymbol,
      taxRatePercent: s.taxRatePercent,
      deliveryFee: s.deliveryFee,
      minOrderValue: s.minOrderValue,
      orderAcceptanceEnabled: s.orderAcceptanceEnabled,
      tableReservationEnabled: s.tableReservationEnabled,
      zomatoRating: s.zomatoRating,
      socialInstagram: s.socialInstagram,
      socialFacebook: s.socialFacebook,
    };
  },

  /**
   * Real-time operational check: open hours, kitchen order acceptance, and reservation availability
   */
  async getOperationalStatus(): Promise<RestaurantOperationalStatus> {
    const s = await this.getInfo();
    const { isOpen, currentTimeStr, dayOfWeekStr } = evaluateOpeningHours(
      s.openingHours || 'Monday – Sunday: 12:00 PM – 11:30 PM',
      s.timezone || 'Asia/Kolkata'
    );

    const isOnlineOrderingAvailable = isOpen && s.orderAcceptanceEnabled;
    const isTableReservationAvailable = s.tableReservationEnabled;

    let message = 'Restaurant is open and accepting online orders and table reservations.';
    if (!isOpen) {
      message = `Restaurant is currently closed. Operating hours: ${s.openingHours}.`;
    } else if (!s.orderAcceptanceEnabled && !s.tableReservationEnabled) {
      message = 'Online ordering and table reservations are currently paused.';
    } else if (!s.orderAcceptanceEnabled) {
      message = 'Online order placement is temporarily paused by the kitchen during peak rush.';
    } else if (!s.tableReservationEnabled) {
      message = 'Table reservations are currently at full capacity.';
    }

    return {
      isOpen,
      orderAcceptanceEnabled: s.orderAcceptanceEnabled,
      tableReservationEnabled: s.tableReservationEnabled,
      isOnlineOrderingAvailable,
      isTableReservationAvailable,
      openingHours: s.openingHours,
      timezone: s.timezone || 'Asia/Kolkata',
      currentTime: currentTimeStr,
      dayOfWeek: dayOfWeekStr,
      message,
    };
  },

  /**
   * Update restaurant profile, branding, contacts, and tax/delivery configuration
   */
  async updateInfo(updates: RestaurantUpdatePayload, username = 'admin'): Promise<RestaurantDetails> {
    const cleanUpdates: any = { ...updates };

    if (cleanUpdates.taxRatePercent !== undefined) {
      cleanUpdates.taxRatePercent = Number(cleanUpdates.taxRatePercent);
    }
    if (cleanUpdates.deliveryFee !== undefined) {
      cleanUpdates.deliveryFee = Number(cleanUpdates.deliveryFee);
    }
    if (cleanUpdates.minOrderValue !== undefined) {
      cleanUpdates.minOrderValue = Number(cleanUpdates.minOrderValue);
    }
    if (cleanUpdates.orderAcceptanceEnabled !== undefined) {
      cleanUpdates.orderAcceptanceEnabled = Boolean(cleanUpdates.orderAcceptanceEnabled);
    }
    if (cleanUpdates.tableReservationEnabled !== undefined) {
      cleanUpdates.tableReservationEnabled = Boolean(cleanUpdates.tableReservationEnabled);
    }

    let updatedDoc: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        updatedDoc = await Setting.findOneAndUpdate(
          {},
          { $set: cleanUpdates },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean();
      } catch { }
    }

    let updated: any = updatedDoc;
    db.updateState((s) => {
      s.settings = { ...s.settings, ...cleanUpdates };
      if (!updated) updated = s.settings;
    });

    db.logAudit('UPDATE_RESTAURANT_INFO', username, 'Updated restaurant details and operating profile');
    return updated as RestaurantDetails;
  },

  /**
   * Kitchen Rush Emergency Killswitch: Toggle online order acceptance
   */
  async toggleOrderAcceptance(
    enabled?: boolean,
    username = 'staff',
    reason?: string
  ): Promise<{ orderAcceptanceEnabled: boolean; message: string; updatedAt: string }> {
    const current = await this.getInfo();
    const newStatus = typeof enabled === 'boolean' ? enabled : !current.orderAcceptanceEnabled;

    await this.updateInfo({ orderAcceptanceEnabled: newStatus }, username);

    const logMessage = `Online order acceptance ${newStatus ? 'ENABLED' : 'PAUSED'}. Reason: ${
      reason || 'Kitchen operating status toggle'
    }`;
    db.logAudit('TOGGLE_ORDER_ACCEPTANCE', username, logMessage);

    return {
      orderAcceptanceEnabled: newStatus,
      message: newStatus
        ? 'Online order placement is now active and accepting orders.'
        : 'Online order placement has been paused. Customers will be notified.',
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * Capacity Control Killswitch: Toggle table reservation acceptance
   */
  async toggleTableReservation(
    enabled?: boolean,
    username = 'staff',
    reason?: string
  ): Promise<{ tableReservationEnabled: boolean; message: string; updatedAt: string }> {
    const current = await this.getInfo();
    const newStatus = typeof enabled === 'boolean' ? enabled : !current.tableReservationEnabled;

    await this.updateInfo({ tableReservationEnabled: newStatus }, username);

    const logMessage = `Table reservations ${newStatus ? 'ENABLED' : 'PAUSED'}. Reason: ${
      reason || 'Dining room capacity toggle'
    }`;
    db.logAudit('TOGGLE_TABLE_RESERVATIONS', username, logMessage);

    return {
      tableReservationEnabled: newStatus,
      message: newStatus
        ? 'Table reservations are now open for bookings.'
        : 'Table reservations have been paused due to capacity limits.',
      updatedAt: new Date().toISOString(),
    };
  },
};

export default restaurantService;
