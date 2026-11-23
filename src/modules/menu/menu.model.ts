import mongoose, { Schema, Model } from 'mongoose';
import { IFoodItemDocument } from './menu.interface.js';

export type { IFoodItemDocument } from './menu.interface.js';

export interface IMenuItemModel extends Model<IFoodItemDocument> {}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const menuItemSchema = new Schema<IFoodItemDocument>(
  {
    name: {
      type: String,
      required: [true, 'Dish name is required'],
      trim: true,
      maxlength: [120, 'Dish name cannot exceed 120 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Dish slug is required'],
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Dish category is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Short description is required'],
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
    fullDescription: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Price must be a positive number'],
    },
    compareAtPrice: {
      type: Number,
      min: [0, 'Compare-at price must be a positive number'],
    },
    image: {
      type: String,
      default: '/uploads/menu/default-dish.webp',
    },
    isVeg: {
      type: Boolean,
      default: true,
    },
    isSignature: {
      type: Boolean,
      default: false,
    },
    spiceLevel: {
      type: Number,
      enum: [1, 2, 3],
      default: 2,
    },
    preparationTime: {
      type: String,
      default: '20 mins',
      trim: true,
    },
    ingredients: {
      type: [String],
      default: [],
    },
    chefNote: {
      type: String,
      trim: true,
      default: '',
    },
    available: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
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

// High-performance query indexes
menuItemSchema.index({ slug: 1 }, { unique: true });
menuItemSchema.index({ available: 1, category: 1, displayOrder: 1 });
menuItemSchema.index({ available: 1, isVeg: 1, displayOrder: 1 });
menuItemSchema.index({ displayOrder: 1, createdAt: 1 });
menuItemSchema.index({ name: 'text', description: 'text', ingredients: 'text' });

menuItemSchema.pre('validate', function () {
  if (this.name && (!this.slug || this.isModified('name'))) {
    this.slug = slugify(this.name);
  }
});

export const MenuItem =
  (mongoose.models.MenuItem as IMenuItemModel) ||
  mongoose.model<IFoodItemDocument, IMenuItemModel>('MenuItem', menuItemSchema);
