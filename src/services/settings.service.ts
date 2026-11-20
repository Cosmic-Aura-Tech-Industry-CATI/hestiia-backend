import { connectDB } from '@/lib/mongodb';
import { logAudit } from '@/lib/audit';
import { IRestaurantSettings, SettingModel } from '@/models/Setting.model';
import { cleanDoc } from '@/models/_schema';

const DEFAULT_SETTINGS: IRestaurantSettings = {
  key: 'default',
  restaurantName: 'HESTIIA RESTAURANT',
  tagline: 'Flavours That Stay With You',
  eyebrow: 'A MODERN INDIAN DINING EXPERIENCE',
  description:
    'Discover a memorable dining experience with rich Indian flavours, thoughtfully crafted dishes and an ambience made for every occasion in Shyam Nagar, Kanpur.',
  address: 'PAC Road, Shyam Nagar, Kanpur, Uttar Pradesh 208013',
  phone: '+91 98390 12345',
  whatsapp: '+91 98390 12345',
  email: 'reservations@hestiia.com',
  openingHours: '11:30 AM – 11:30 PM (Open All Days)',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  currencySymbol: '₹',
  taxRatePercent: 5,
  deliveryFee: 40,
  minOrderValue: 200,
  orderAcceptanceEnabled: true,
  tableReservationEnabled: true,
  invoicePrefix: 'HST-INV',
  zomatoRating: '4.6 ★',
  socialInstagram: 'https://instagram.com/hestiiakanpur',
  socialFacebook: 'https://facebook.com/hestiiakanpur',
};

export const settingsService = {
  async getAdminSettings(): Promise<IRestaurantSettings> {
    await connectDB();
    let doc = await SettingModel.findOne({ key: 'default' }).lean();
    if (!doc) {
      await SettingModel.create(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }
    return cleanDoc<IRestaurantSettings>(doc);
  },

  async getPublicSettings() {
    const s = await this.getAdminSettings();
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

  async updateSettings(updates: any, username = 'admin') {
    await connectDB();
    const current = await this.getAdminSettings();

    const nextSettings: IRestaurantSettings = {
      ...current,
      ...updates,
      key: 'default',
      taxRatePercent:
        updates.taxRatePercent !== undefined
          ? Number(updates.taxRatePercent)
          : current.taxRatePercent,
      deliveryFee:
        updates.deliveryFee !== undefined
          ? Number(updates.deliveryFee)
          : current.deliveryFee,
      minOrderValue:
        updates.minOrderValue !== undefined
          ? Number(updates.minOrderValue)
          : current.minOrderValue,
      orderAcceptanceEnabled:
        updates.orderAcceptanceEnabled !== undefined
          ? Boolean(updates.orderAcceptanceEnabled)
          : current.orderAcceptanceEnabled,
      tableReservationEnabled:
        updates.tableReservationEnabled !== undefined
          ? Boolean(updates.tableReservationEnabled)
          : current.tableReservationEnabled,
    };

    const updated = await SettingModel.findOneAndUpdate(
      { key: 'default' },
      { $set: nextSettings },
      { new: true, upsert: true }
    ).lean();

    await logAudit(
      'UPDATE_SETTINGS',
      username,
      'Updated restaurant settings and operating configuration'
    );
    return cleanDoc<IRestaurantSettings>(updated);
  },
};
