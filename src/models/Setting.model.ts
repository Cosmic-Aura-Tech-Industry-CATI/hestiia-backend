import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface IRestaurantSettings {
  key: string;
  restaurantName: string;
  tagline: string;
  eyebrow: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  openingHours: string;
  timezone: string;
  currency: string;
  currencySymbol: string;
  taxRatePercent: number;
  deliveryFee: number;
  minOrderValue: number;
  orderAcceptanceEnabled: boolean;
  tableReservationEnabled: boolean;
  invoicePrefix: string;
  zomatoRating: string;
  socialInstagram: string;
  socialFacebook: string;
}

const SettingSchema = new Schema<IRestaurantSettings>({
  key: { type: String, default: 'default', unique: true, index: true },
  restaurantName: { type: String, required: true },
  tagline: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
  description: { type: String, default: '' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
  email: { type: String, default: '' },
  openingHours: { type: String, default: '' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  currency: { type: String, default: 'INR' },
  currencySymbol: { type: String, default: '₹' },
  taxRatePercent: { type: Number, default: 5 },
  deliveryFee: { type: Number, default: 40 },
  minOrderValue: { type: Number, default: 200 },
  orderAcceptanceEnabled: { type: Boolean, default: true },
  tableReservationEnabled: { type: Boolean, default: true },
  invoicePrefix: { type: String, default: 'HST-INV' },
  zomatoRating: { type: String, default: '' },
  socialInstagram: { type: String, default: '' },
  socialFacebook: { type: String, default: '' },
});

applyCleanTransform(SettingSchema);

export const SettingModel: Model<IRestaurantSettings> =
  mongoose.models.Setting || mongoose.model<IRestaurantSettings>('Setting', SettingSchema);
