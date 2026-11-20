import { db } from '../../shared/config/db.js';

export const settingsService = {
  async getPublicSettings() {
    const s = db.getState().settings;
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

  async getAdminSettings() {
    return db.getState().settings;
  },

  async updateSettings(updates: any, username = 'admin') {
    let updatedSettings: any = null;

    db.updateState((s) => {
      s.settings = {
        ...s.settings,
        ...updates,
        taxRatePercent: updates.taxRatePercent !== undefined ? Number(updates.taxRatePercent) : s.settings.taxRatePercent,
        deliveryFee: updates.deliveryFee !== undefined ? Number(updates.deliveryFee) : s.settings.deliveryFee,
        minOrderValue: updates.minOrderValue !== undefined ? Number(updates.minOrderValue) : s.settings.minOrderValue,
        orderAcceptanceEnabled: updates.orderAcceptanceEnabled !== undefined ? Boolean(updates.orderAcceptanceEnabled) : s.settings.orderAcceptanceEnabled,
        tableReservationEnabled: updates.tableReservationEnabled !== undefined ? Boolean(updates.tableReservationEnabled) : s.settings.tableReservationEnabled,
      };
      updatedSettings = s.settings;
    });

    db.logAudit('UPDATE_SETTINGS', username, 'Updated restaurant settings and operating configuration');
    return updatedSettings;
  },
};
