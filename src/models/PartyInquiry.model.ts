import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface IPartyInquiry {
  id: string;
  customerName: string;
  phone: string;
  email?: string;
  eventType: 'birthday' | 'anniversary' | 'corporate' | 'family_gathering' | 'other';
  preferredDate: string;
  guestCount: number;
  budgetRange?: string;
  specialRequirements?: string;
  status: 'new' | 'contacted' | 'proposal_sent' | 'booked' | 'closed';
  staffNotes?: string;
  followUpDate?: string;
  createdAt: string;
  updatedAt: string;
}

const PartyInquirySchema = new Schema<IPartyInquiry>({
  id: { type: String, required: true, unique: true, index: true },
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  eventType: {
    type: String,
    enum: ['birthday', 'anniversary', 'corporate', 'family_gathering', 'other'],
    default: 'other',
  },
  preferredDate: { type: String, required: true },
  guestCount: { type: Number, required: true },
  budgetRange: { type: String },
  specialRequirements: { type: String },
  status: {
    type: String,
    enum: ['new', 'contacted', 'proposal_sent', 'booked', 'closed'],
    default: 'new',
    index: true,
  },
  staffNotes: { type: String, default: '' },
  followUpDate: { type: String },
  createdAt: { type: String, required: true, index: true },
  updatedAt: { type: String, required: true },
});

applyCleanTransform(PartyInquirySchema);

export const PartyInquiryModel: Model<IPartyInquiry> =
  mongoose.models.PartyInquiry ||
  mongoose.model<IPartyInquiry>('PartyInquiry', PartyInquirySchema);
