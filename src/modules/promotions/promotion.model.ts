import mongoose, { Schema, Model } from 'mongoose';

export interface IPromotionDocument extends mongoose.Document {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  originalPrice: number;
  serves: string;
  badge: string;
  items: string[];
  image: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPromotionModel extends Model<IPromotionDocument> {}

const promotionSchema = new Schema<IPromotionDocument>(
  {
    title: {
      type: String,
      required: [true, 'Promotion title is required'],
      trim: true,
      maxlength: [120, 'Promotion title cannot exceed 120 characters'],
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Special promotional price is required'],
      min: 0,
    },
    originalPrice: {
      type: Number,
      min: 0,
    },
    serves: {
      type: String,
      default: '2 Guests',
      trim: true,
    },
    badge: {
      type: String,
      default: 'Special Offer',
      trim: true,
    },
    items: {
      type: [String],
      default: [],
    },
    image: {
      type: String,
      default: '/images/dishes/handi-paneer.jpg',
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
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

promotionSchema.index({ isActive: 1, displayOrder: 1 });

export const Promotion =
  (mongoose.models.Promotion as IPromotionModel) ||
  mongoose.model<IPromotionDocument, IPromotionModel>('Promotion', promotionSchema);

export default Promotion;
