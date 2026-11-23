import { Document, Types } from 'mongoose';

export type BookingStatus = 'new' | 'contacted' | 'confirmed' | 'rescheduled' | 'rejected' | 'completed' | 'cancelled';
export type ConfirmationMethod = 'on-screen' | 'whatsapp' | 'call';

export interface IBooking {
  _id?: Types.ObjectId;
  id?: string;
  bookingRef: string;
  customerName: string;
  phone: string;
  email?: string;
  date: string;
  time: string;
  guests: string;
  occasion: string;
  specialRequests?: string;
  status: BookingStatus;
  allocatedTable?: string;
  staffNotes?: string;
  confirmationMethod?: ConfirmationMethod;
  holdPolicy: string;
  confirmedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IBookingDocument extends Document {
  bookingRef: string;
  customerName: string;
  phone: string;
  email?: string;
  date: string;
  time: string;
  guests: string;
  occasion: string;
  specialRequests?: string;
  status: BookingStatus;
  allocatedTable?: string;
  staffNotes?: string;
  confirmationMethod?: ConfirmationMethod;
  holdPolicy: string;
  confirmedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
