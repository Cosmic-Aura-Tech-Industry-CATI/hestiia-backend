import mongoose, { Schema, Document } from 'mongoose';
import { IEvent } from '../interfaces/events.interface.js';

export interface IEventDocument extends Omit<IEvent, 'id' | '_id'>, Document {}

const ServiceProvidedSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const EventSchema = new Schema<IEventDocument>(
  {
    event_name: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    event_date: { type: Date, required: true, index: true },
    attendee_count: { type: Number, required: true, min: 1 },
    services_provided: { type: [ServiceProvidedSchema], default: [] },
    location: { type: String, default: 'Hestiia Banquet & Lawn, Kanpur', trim: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    cover_image: { type: String, default: '' },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
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

EventSchema.index({ status: 1, event_date: -1 });

export const Event = (mongoose.models.Event as mongoose.Model<IEventDocument>) || mongoose.model<IEventDocument>('Event', EventSchema);
export default Event;

