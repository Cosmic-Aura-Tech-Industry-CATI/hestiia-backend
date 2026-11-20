import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface ITableBooking {
  id: string;
  bookingRef: string;
  customerName: string;
  phone: string;
  email?: string;
  date: string;
  time: string;
  guests: string;
  occasion: string;
  specialRequests?: string;
  status:
    | 'new'
    | 'contacted'
    | 'confirmed'
    | 'rescheduled'
    | 'rejected'
    | 'completed'
    | 'cancelled';
  allocatedTable?: string;
  confirmationMethod?: 'on-screen' | 'whatsapp' | 'call';
  holdPolicy?: string;
  staffNotes?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const BookingSchema = new Schema<ITableBooking>({
  id: { type: String, required: true, unique: true, index: true },
  bookingRef: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  date: { type: String, required: true, index: true },
  time: { type: String, required: true },
  guests: { type: String, default: '2 Guests' },
  occasion: { type: String, default: 'Dining' },
  specialRequests: { type: String },
  status: {
    type: String,
    enum: ['new', 'contacted', 'confirmed', 'rescheduled', 'rejected', 'completed', 'cancelled'],
    default: 'new',
    index: true,
  },
  allocatedTable: { type: String },
  confirmationMethod: { type: String, enum: ['on-screen', 'whatsapp', 'call'] },
  holdPolicy: { type: String },
  staffNotes: { type: String, default: '' },
  confirmedAt: { type: String },
  createdAt: { type: String, required: true, index: true },
  updatedAt: { type: String, required: true },
});

applyCleanTransform(BookingSchema);

export const BookingModel: Model<ITableBooking> =
  mongoose.models.Booking || mongoose.model<ITableBooking>('Booking', BookingSchema);
