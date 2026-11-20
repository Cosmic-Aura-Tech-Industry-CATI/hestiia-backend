import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface IReviewItem {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  dishName?: string;
  source: 'website' | 'google' | 'direct';
  isApproved: boolean;
  staffReply?: string;
  createdAt: string;
}

const ReviewSchema = new Schema<IReviewItem>({
  id: { type: String, required: true, unique: true, index: true },
  customerName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  dishName: { type: String },
  source: { type: String, enum: ['website', 'google', 'direct'], default: 'website' },
  isApproved: { type: Boolean, default: false, index: true },
  staffReply: { type: String },
  createdAt: { type: String, required: true, index: true },
});

applyCleanTransform(ReviewSchema);

export const ReviewModel: Model<IReviewItem> =
  mongoose.models.Review || mongoose.model<IReviewItem>('Review', ReviewSchema);
