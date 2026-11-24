import mongoose, { Schema, Document } from 'mongoose';
import { IOffer } from '../interfaces/offer.interface.js';

export interface IOfferDocument extends Omit<IOffer, '_id'>, Document {}

const OfferSchema = new Schema<IOfferDocument>(
  {
    title: {
      type: String,
      required: [true, 'Offer title is required'],
      trim: true,
      maxlength: [150, 'Offer title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Offer description is required'],
      trim: true,
      maxlength: [1000, 'Offer description cannot exceed 1000 characters'],
    },
    discountType: {
      type: String,
      enum: {
        values: ['fixed', 'percentage'],
        message: 'Discount type must be either "fixed" or "percentage"',
      },
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [1, 'Discount value must be greater than 0'],
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order value cannot be negative'],
    },
    maxDiscount: {
      type: Number,
      default: null,
      min: [0, 'Maximum discount cap cannot be negative'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true,
    },
    placements: {
      type: [String],
      enum: ['home', 'menu'],
      default: ['home', 'menu'],
      index: true,
    },
    bannerImage: {
      type: String,
      default: '',
      trim: true,
    },
    termsAndConditions: {
      type: [String],
      default: [],
    },
    displayPriority: {
      type: Number,
      default: 1,
      min: [1, 'Display priority must be at least 1'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret._id = ret._id ? ret._id.toString() : ret.id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

OfferSchema.index({ isActive: 1, isArchived: 1, startDate: 1, endDate: 1 });
OfferSchema.index({ placements: 1, displayPriority: 1 });
OfferSchema.index({ createdAt: -1 });

export const Offer =
  (mongoose.models.Offer as mongoose.Model<IOfferDocument>) ||
  mongoose.model<IOfferDocument>('Offer', OfferSchema);

export default Offer;
