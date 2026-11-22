import mongoose, { Schema, Model } from 'mongoose';
import { ICategoryDocument } from './category.interface.js';

export type { ICategoryDocument } from './category.interface.js';

export interface ICategoryModel extends Model<ICategoryDocument> {}

const categorySchema = new Schema<ICategoryDocument>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [80, 'Category name cannot exceed 80 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: '',
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, 'Display order must be a non-negative number'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
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

// Optimized compound indexes
categorySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);
categorySchema.index({ isActive: 1, displayOrder: 1, createdAt: 1 });
categorySchema.index({ displayOrder: 1, createdAt: 1 });

export const Category =
  (mongoose.models.Category as ICategoryModel) ||
  mongoose.model<ICategoryDocument, ICategoryModel>('Category', categorySchema);
