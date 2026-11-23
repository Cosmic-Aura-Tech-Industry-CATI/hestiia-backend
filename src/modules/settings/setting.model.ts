import mongoose, { Schema, Model } from 'mongoose';

export interface ISettingDocument extends mongoose.Document {
  id: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface ISettingModel extends Model<ISettingDocument> {}

const settingSchema = new Schema<ISettingDocument>(
  {
    restaurantName: { type: String, default: 'Hestiia Restaurant' },
    tagline: { type: String, default: 'Exquisite Fine Dining & Culinary Artistry' },
    eyebrow: { type: String, default: 'DIMISI HOSPITALITY' },
    description: { type: String, default: 'Experience authentic luxury dining and handcrafted cuisine.' },
    address: { type: String, default: 'Plot 42, Royal Boulevard, Sector 18, Lucknow, UP 226001' },
    phone: { type: String, default: '+91 98765 43210' },
    whatsapp: { type: String, default: '+91 98765 43210' },
    email: { type: String, default: 'contact@hestiiarestaurant.com' },
    openingHours: { type: String, default: 'Mon-Sun: 11:30 AM – 11:30 PM' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    currencySymbol: { type: String, default: '₹' },
    taxRatePercent: { type: Number, default: 5 },
    deliveryFee: { type: Number, default: 40 },
    minOrderValue: { type: Number, default: 299 },
    orderAcceptanceEnabled: { type: Boolean, default: true },
    tableReservationEnabled: { type: Boolean, default: true },
    invoicePrefix: { type: String, default: 'HST-INV' },
    zomatoRating: { type: String, default: '4.8' },
    socialInstagram: { type: String, default: 'https://instagram.com/hestiiarestaurant' },
    socialFacebook: { type: String, default: 'https://facebook.com/hestiiarestaurant' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Setting =
  (mongoose.models.Setting as ISettingModel) ||
  mongoose.model<ISettingDocument, ISettingModel>('Setting', settingSchema);

export default Setting;
