import mongoose, { Schema, Model } from 'mongoose';
import { IBookingDocument } from './booking.interface.js';

export type { IBookingDocument } from './booking.interface.js';

export interface IBookingModel extends Model<IBookingDocument> {}

const bookingSchema = new Schema<IBookingDocument>(
  {
    bookingRef: {
      type: String,
      required: [true, 'Booking reference is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
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
    date: {
      type: String,
      required: [true, 'Reservation date is required'],
      trim: true,
    },
    time: {
      type: String,
      required: [true, 'Reservation time slot is required'],
      trim: true,
    },
    guests: {
      type: String,
      default: '2 Guests',
      trim: true,
    },
    occasion: {
      type: String,
      default: 'Dining',
      trim: true,
    },
    specialRequests: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'confirmed', 'rescheduled', 'rejected', 'completed', 'cancelled'],
      default: 'new',
    },
    allocatedTable: {
      type: String,
      trim: true,
      default: '',
    },
    staffNotes: {
      type: String,
      trim: true,
      default: '',
    },
    confirmationMethod: {
      type: String,
      enum: ['on-screen', 'whatsapp', 'call'],
      default: 'on-screen',
    },
    holdPolicy: {
      type: String,
      default: 'Table is held for 15 minutes beyond your reserved time slot before release.',
    },
    confirmedAt: {
      type: Date,
      default: null,
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
bookingSchema.index({ date: 1, time: 1 });
bookingSchema.index({ status: 1, date: 1 });
bookingSchema.index({ phone: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ customerName: 'text', phone: 'text', email: 'text', bookingRef: 'text', allocatedTable: 'text', staffNotes: 'text' });

export const Booking =
  (mongoose.models.Booking as IBookingModel) ||
  mongoose.model<IBookingDocument, IBookingModel>('Booking', bookingSchema);
