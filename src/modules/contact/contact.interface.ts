import { Document } from 'mongoose';

export type ContactStatus = 'new' | 'in_progress' | 'responded' | 'archived';

export type ContactSubject =
  | 'general'
  | 'feedback'
  | 'complaint'
  | 'catering'
  | 'events'
  | 'partnership'
  | 'careers'
  | 'other';

export interface IContactInquiry {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: ContactStatus;
  responseNotes?: string;
  respondedAt?: Date;
  respondedBy?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IContactDocument extends IContactInquiry, Document {
  id: string;
}

export interface ContactFilterQuery {
  status?: ContactStatus;
  subject?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number | string;
  limit?: number | string;
  sort?: string;
}
