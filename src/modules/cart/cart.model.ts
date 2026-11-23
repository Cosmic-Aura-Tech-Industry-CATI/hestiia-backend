import mongoose, { Schema, Model } from 'mongoose';
import { ICart, ICartItem } from './cart.interface.js';

export type { ICart, ICartItem } from './cart.interface.js';

export interface ICartDocument extends Omit<ICart, 'id' | '_id'>, mongoose.Document {
  id: string;
}

export interface ICartModel extends Model<ICartDocument> {}

const cartItemSchema = new Schema<ICartItem>(
  {
    dishId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    priceInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    totalInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    image: {
      type: String,
      default: '/uploads/menu/default-dish.webp',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const cartSchema = new Schema<ICartDocument>(
  {
    guestId: {
      type: String,
      required: [true, 'Guest identifier is required for cart persistence'],
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: String,
      sparse: true,
      trim: true,
    },
    fulfillmentType: {
      type: String,
      enum: ['delivery', 'dine-in', 'pickup'],
      default: 'delivery',
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    subtotalInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotalInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    appliedCoupon: {
      type: String,
      trim: true,
      default: '',
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day session retention
      index: { expires: 0 }, // TTL index: MongoDB automatically evicts inactive carts
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

cartSchema.index({ guestId: 1, 'items.dishId': 1 });

export type Cart = ICartDocument;
export const Cart =
  (mongoose.models.Cart as ICartModel) ||
  mongoose.model<ICartDocument, ICartModel>('Cart', cartSchema);

export default Cart;
