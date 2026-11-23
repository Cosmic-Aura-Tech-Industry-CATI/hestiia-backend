import mongoose, { Schema, Document } from 'mongoose';
import { IWishlist, IWishlistItem } from '../interfaces/wishlist.interface.js';

export interface IWishlistDocument extends Omit<IWishlist, 'id' | '_id'>, Document {}

const WishlistItemSchema = new Schema<IWishlistItem>(
  {
    menu_item_id: { type: String, required: true, trim: true },
    added_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WishlistSchema = new Schema<IWishlistDocument>(
  {
    guest_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    items: {
      type: [WishlistItemSchema],
      default: [],
    },
    expires_at: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL Index: automatically removes document after expires_at
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

WishlistSchema.index({ guest_id: 1, 'items.menu_item_id': 1 });

export const Wishlist =
  (mongoose.models.Wishlist as mongoose.Model<IWishlistDocument>) ||
  mongoose.model<IWishlistDocument>('Wishlist', WishlistSchema);

export default Wishlist;
