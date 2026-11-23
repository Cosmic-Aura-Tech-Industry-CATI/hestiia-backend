import mongoose, { Schema, Document } from 'mongoose';
import { IGallerySection } from '../interfaces/gallery.interface.js';

export interface IGallerySectionDocument extends Omit<IGallerySection, 'id' | '_id'>, Document {}

const GallerySectionSchema = new Schema<IGallerySectionDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isPublic: { type: Boolean, default: true, index: true },
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

GallerySectionSchema.index({ isActive: 1, isPublic: 1, displayOrder: 1 });

export const GallerySection =
  (mongoose.models.GallerySection as mongoose.Model<IGallerySectionDocument>) ||
  mongoose.model<IGallerySectionDocument>('GallerySection', GallerySectionSchema);

export default GallerySection;
