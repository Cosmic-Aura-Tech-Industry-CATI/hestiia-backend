import mongoose, { Schema, Document } from 'mongoose';
import { IEventInquiry } from '../interfaces/events.interface.js';

export interface IEventInquiryDocument extends Omit<IEventInquiry, 'id' | '_id'>, Document {}

const EventInquirySchema = new Schema<IEventInquiryDocument>(
  {
    customer_name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true, index: true },
    event_type: { type: String, required: true, trim: true },
    preferred_date: { type: Date, required: true, index: true },
    expected_attendees: { type: Number, required: true, min: 1 },
    requirements: { type: String, trim: true },
    message: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'confirmed', 'rejected', 'completed'],
      default: 'pending',
      index: true,
    },
    admin_notes: { type: String, trim: true, default: '' },
    booking_id: { type: String, default: null },
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

EventInquirySchema.index({ status: 1, preferred_date: 1 });

export const EventInquiry =
  (mongoose.models.EventInquiry as mongoose.Model<IEventInquiryDocument>) ||
  mongoose.model<IEventInquiryDocument>('EventInquiry', EventInquirySchema);
export default EventInquiry;

