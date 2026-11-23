import { Document, Types } from 'mongoose';

export type PartyEventType = 'birthday' | 'anniversary' | 'corporate' | 'family_gathering' | 'other';
export type PartyInquiryStatus = 'new' | 'contacted' | 'quoted' | 'confirmed' | 'cancelled';

export interface IPartyInquiry {
  _id?: Types.ObjectId;
  id?: string;
  customerName: string;
  phone: string;
  email?: string;
  eventType: PartyEventType;
  preferredDate: string;
  guestCount: number;
  budgetRange?: string;
  specialRequirements?: string;
  status: PartyInquiryStatus;
  staffNotes?: string;
  followUpDate?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IPartyInquiryDocument extends Document {
  customerName: string;
  phone: string;
  email?: string;
  eventType: PartyEventType;
  preferredDate: string;
  guestCount: number;
  budgetRange?: string;
  specialRequirements?: string;
  status: PartyInquiryStatus;
  staffNotes?: string;
  followUpDate?: string;
  createdAt: Date;
  updatedAt: Date;
}
