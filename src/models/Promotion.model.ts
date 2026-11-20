import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface IPromotion {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  originalPrice?: number;
  serves: string;
  badge: string;
  items: string[];
  image: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  displayOrder: number;
}

const PromotionSchema = new Schema<IPromotion>({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  serves: { type: String, default: '2 Guests' },
  badge: { type: String, default: 'Special Offer' },
  items: { type: [String], default: [] },
  image: { type: String, default: '' },
  startDate: { type: String },
  endDate: { type: String },
  isActive: { type: Boolean, default: true, index: true },
  displayOrder: { type: Number, default: 1 },
});

applyCleanTransform(PromotionSchema);

export const PromotionModel: Model<IPromotion> =
  mongoose.models.Promotion || mongoose.model<IPromotion>('Promotion', PromotionSchema);
