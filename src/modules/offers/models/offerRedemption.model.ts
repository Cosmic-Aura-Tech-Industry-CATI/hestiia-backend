import mongoose, { Schema, Document } from 'mongoose';
import { IOfferRedemption } from '../interfaces/offer.interface.js';

export interface IOfferRedemptionDocument extends Omit<IOfferRedemption, '_id'>, Document {}

const OfferRedemptionSchema = new Schema<IOfferRedemptionDocument>(
  {
    offerId: {
      type: String,
      required: [true, 'Offer ID is required'],
      index: true,
    },
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      unique: true, // Idempotent: strictly 1 redemption per order
      index: true,
    },
    discountAmount: {
      type: Number,
      required: [true, 'Discount amount is required'],
      min: [0, 'Discount amount cannot be negative'],
    },
    orderSubtotal: {
      type: Number,
      required: [true, 'Order subtotal is required'],
      min: [0, 'Order subtotal cannot be negative'],
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret._id = ret._id ? ret._id.toString() : ret.id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const OfferRedemption =
  (mongoose.models.OfferRedemption as mongoose.Model<IOfferRedemptionDocument>) ||
  mongoose.model<IOfferRedemptionDocument>('OfferRedemption', OfferRedemptionSchema);

export default OfferRedemption;
