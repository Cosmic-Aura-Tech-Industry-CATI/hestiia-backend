import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface IFoodItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  categoryId?: string;
  description: string;
  fullDescription: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  isVeg: boolean;
  isSignature?: boolean;
  spiceLevel: 1 | 2 | 3;
  preparationTime: string;
  ingredients: string[];
  chefNote?: string;
  available: boolean;
  displayOrder?: number;
  createdAt: string;
  updatedAt: string;
}

const DishSchema = new Schema<IFoodItem>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  categoryId: { type: String },
  description: { type: String, default: '' },
  fullDescription: { type: String, default: '' },
  price: { type: Number, required: true },
  compareAtPrice: { type: Number },
  image: { type: String, default: '' },
  isVeg: { type: Boolean, default: true },
  isSignature: { type: Boolean, default: false },
  spiceLevel: { type: Number, enum: [1, 2, 3], default: 2 },
  preparationTime: { type: String, default: '20 mins' },
  ingredients: { type: [String], default: [] },
  chefNote: { type: String },
  available: { type: Boolean, default: true, index: true },
  displayOrder: { type: Number, default: 99 },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
});

applyCleanTransform(DishSchema);

export const DishModel: Model<IFoodItem> =
  mongoose.models.Dish || mongoose.model<IFoodItem>('Dish', DishSchema);
