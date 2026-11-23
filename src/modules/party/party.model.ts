import mongoose, { Schema, Model } from 'mongoose';
import { IPartyInquiryDocument } from './party.interface.js';

export type { IPartyInquiryDocument } from './party.interface.js';

export interface IPartyInquiryModel extends Model<IPartyInquiryDocument> {}

const partyInquirySchema = new Schema<IPartyInquiryDocument>(
  {
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Customer name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    eventType: {
      type: String,
      enum: ['birthday', 'anniversary', 'corporate', 'family_gathering', 'other'],
      default: 'other',
    },
    preferredDate: {
      type: String,
      required: [true, 'Preferred event date is required'],
      trim: true,
    },
    guestCount: {
      type: Number,
      required: [true, 'Estimated guest count is required'],
      min: [1, 'Guest count must be at least 1'],
      default: 10,
    },
    budgetRange: {
      type: String,
      trim: true,
      default: '',
    },
    specialRequirements: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'quoted', 'confirmed', 'cancelled'],
      default: 'new',
    },
    staffNotes: {
      type: String,
      trim: true,
      default: '',
    },
    followUpDate: {
      type: String,
      trim: true,
      default: '',
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

// High-performance query indexes
partyInquirySchema.index({ status: 1, createdAt: -1 });
partyInquirySchema.index({ eventType: 1, createdAt: -1 });
partyInquirySchema.index({ phone: 1 });
partyInquirySchema.index({ createdAt: -1 });
partyInquirySchema.index({ customerName: 'text', phone: 'text', email: 'text', staffNotes: 'text' });

export const PartyInquiry =
  (mongoose.models.PartyInquiry as IPartyInquiryModel) ||
  mongoose.model<IPartyInquiryDocument, IPartyInquiryModel>('PartyInquiry', partyInquirySchema);
