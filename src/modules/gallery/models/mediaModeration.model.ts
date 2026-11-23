import mongoose, { Schema, Document } from 'mongoose';
import { IMediaModeration } from '../interfaces/gallery.interface.js';

export interface IMediaModerationDocument extends Omit<IMediaModeration, 'id' | '_id'>, Document {}

const MediaModerationSchema = new Schema<IMediaModerationDocument>(
  {
    mediaId: { type: String, required: true, index: true },
    reviewedBy: { type: String, required: true, trim: true },
    action: {
      type: String,
      enum: ['approved', 'rejected', 'removed'],
      required: true,
      index: true,
    },
    reason: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date, default: Date.now },
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

MediaModerationSchema.index({ mediaId: 1, reviewedAt: -1 });

export const MediaModeration =
  (mongoose.models.MediaModeration as mongoose.Model<IMediaModerationDocument>) ||
  mongoose.model<IMediaModerationDocument>('MediaModeration', MediaModerationSchema);

export default MediaModeration;
