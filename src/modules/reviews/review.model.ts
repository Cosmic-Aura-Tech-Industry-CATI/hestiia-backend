import mongoose, { Schema, Model } from 'mongoose';

export interface IReviewDocument extends mongoose.Document {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  dishName?: string;
  source: 'website' | 'google' | 'direct';
  isApproved: boolean;
  staffReply?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReviewModel extends Model<IReviewDocument> {}

const reviewSchema = new Schema<IReviewDocument>(
  {
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Customer name cannot exceed 100 characters'],
    },
    rating: {
      type: Number,
      required: [true, 'Star rating is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
      index: true,
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    dishName: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: ['website', 'google', 'direct'],
      default: 'website',
    },
    isApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    staffReply: {
      type: String,
      trim: true,
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

reviewSchema.index({ isApproved: 1, createdAt: -1 });

export const Review =
  (mongoose.models.Review as IReviewModel) ||
  mongoose.model<IReviewDocument, IReviewModel>('Review', reviewSchema);

export default Review;
