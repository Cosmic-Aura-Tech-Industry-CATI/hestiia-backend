import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface IFoodCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  icon?: string;
}

const CategorySchema = new Schema<IFoodCategory>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, index: true },
  description: { type: String, default: '' },
  displayOrder: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
  icon: { type: String },
});

applyCleanTransform(CategorySchema);

export const CategoryModel: Model<IFoodCategory> =
  mongoose.models.Category || mongoose.model<IFoodCategory>('Category', CategorySchema);
