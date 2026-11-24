
export interface IPhoneContact {
  number: string;
  enabled: boolean;
}

export interface IEmailContact {
  address: string;
  enabled: boolean;
}

export interface IWhatsAppContact {
  number: string;
  enabled: boolean;
}

export interface IContactSettings {
  _id?: any;
  id?: string;
  phone: IPhoneContact;
  email: IEmailContact;
  whatsapp: IWhatsAppContact;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface IUpdateContactDTO {
  phone?: {
    number?: string;
    enabled?: boolean;
  };
  email?: {
    address?: string;
    enabled?: boolean;
  };
  whatsapp?: {
    number?: string;
    enabled?: boolean;
  };
}

export interface ICustomerContactItem {
  number?: string;
  address?: string;
  action: string;
}

export interface ICustomerContactResponse {
  phone: ICustomerContactItem | null;
  email: ICustomerContactItem | null;
  whatsapp: ICustomerContactItem | null;
}

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
