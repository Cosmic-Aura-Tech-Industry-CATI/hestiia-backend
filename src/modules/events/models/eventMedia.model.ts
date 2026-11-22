import mongoose, { Schema, Document } from 'mongoose';
import { IEventMedia } from '../interfaces/events.interface.js';

export interface IEventMediaDocument extends Omit<IEventMedia, 'id' | '_id'>, Document {}

const EventMediaSchema = new Schema<IEventMediaDocument>(
  {
    event_id: { type: String, required: true, index: true },
    image_url: { type: String, required: true },
    public_id: { type: String, required: true, index: true },
    is_cover: { type: Boolean, default: false },
    display_order: { type: Number, default: 0 },
    caption: { type: String, trim: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

EventMediaSchema.index({ event_id: 1, display_order: 1 });

export const EventMedia =
  (mongoose.models.EventMedia as mongoose.Model<IEventMediaDocument>) ||
  mongoose.model<IEventMediaDocument>('EventMedia', EventMediaSchema);
export default EventMedia;

