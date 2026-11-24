import mongoose, { Schema, Model } from 'mongoose';
import { IOfferDocument } from './offer.interface.js';

export type { IOfferDocument } from './offer.interface.js';

export interface IOfferModel extends Model<IOfferDocument> {}

const offerSchema = new Schema<IOfferDocument>(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [30, 'Coupon code cannot exceed 30 characters'],
    },
    title: {
      type: String,
      required: [true, 'Offer title is required'],
      trim: true,
      maxlength: [120, 'Offer title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed', 'free_shipping'],
      required: [true, 'Discount type is required'],
      default: 'percentage',
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order value cannot be negative'],
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    usageLimit: {
      type: Number,
      min: 0,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: 1,
    },
    applicableFulfillment: {
      type: [String],
      enum: ['delivery', 'dine-in', 'pickup'],
      default: ['delivery', 'dine-in', 'pickup'],
    },
    displayOnBanner: {
      type: Boolean,
      default: false,
    },
    bannerText: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
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

// High performance compound indexes for coupon validation and banner queries
offerSchema.index({ code: 1, isActive: 1 });
offerSchema.index({ displayOnBanner: 1, isActive: 1 });
offerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

export const Offer =
  (mongoose.models.Offer as IOfferModel) ||
  mongoose.model<IOfferDocument, IOfferModel>('Offer', offerSchema);

export default Offer;
