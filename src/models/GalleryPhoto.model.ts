import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface IGalleryPhoto {
  id: string;
  title: string;
  category: string;
  image: string;
  description: string;
  isFeatured: boolean;
  displayOrder: number;
}

const GalleryPhotoSchema = new Schema<IGalleryPhoto>({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  category: { type: String, default: 'Ambience' },
  image: { type: String, required: true },
  description: { type: String, default: '' },
  isFeatured: { type: Boolean, default: false },
  displayOrder: { type: Number, default: 1 },
});

applyCleanTransform(GalleryPhotoSchema);

export const GalleryPhotoModel: Model<IGalleryPhoto> =
  mongoose.models.GalleryPhoto ||
  mongoose.model<IGalleryPhoto>('GalleryPhoto', GalleryPhotoSchema);
