import mongoose, { Schema, Document } from 'mongoose';
import { IMedia } from '../interfaces/gallery.interface.js';

export interface IMediaDocument extends Omit<IMedia, 'id' | '_id'>, Document {}

const MediaSchema = new Schema<IMediaDocument>(
  {
    title: { type: String, trim: true, default: '' },
    caption: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    altText: { type: String, trim: true, default: '' },
    imageUrl: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
    storageProvider: { type: String, enum: ['cloudinary', 'local'], default: 'local' },
    mimeType: { type: String, required: true, trim: true },
    fileSize: { type: Number, default: 0 },
    width: { type: Number },
    height: { type: Number },
    format: { type: String, trim: true },
    uploaderType: { type: String, enum: ['admin', 'customer'], required: true },
    uploadedByAdmin: { type: String, trim: true },
    guestId: { type: String, trim: true, index: true },
    sectionId: { type: String, trim: true, index: true },
    mediaSource: { type: String, enum: ['official', 'customer'], required: true },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'removed'],
      default: 'pending',
      index: true,
    },
    publicationStatus: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
      index: true,
    },
    displayOrder: { type: Number, default: 0 },
    rejectionReason: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret.__v;
        // Never expose internal security fields in JSON
        delete ret.guestId;
        return ret;
      },
    },
  }
);

MediaSchema.index({ publicationStatus: 1, moderationStatus: 1, visibility: 1, displayOrder: 1 });
MediaSchema.index({ guestId: 1, createdAt: -1 });

export const Media =
  (mongoose.models.Media as mongoose.Model<IMediaDocument>) ||
  mongoose.model<IMediaDocument>('Media', MediaSchema);

export default Media;
