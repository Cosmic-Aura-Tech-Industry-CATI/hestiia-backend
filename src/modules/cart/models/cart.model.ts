import mongoose, { Schema, Document } from 'mongoose';
import { ICart } from '../interfaces/cart.interface.js';

export interface ICartDocument extends Omit<ICart, '_id'>, Document {}

const CartItemSchema = new Schema(
  {
    dishId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true, min: 0 },
    image: { type: String, default: '/uploads/menu/default-dish.webp' },
  },
  { _id: false }
);

const AppliedOfferSchema = new Schema(
  {
    offerId: { type: String, required: true },
    title: { type: String, required: true },
    discountType: { type: String, enum: ['fixed', 'percentage'], required: true },
    discountValue: { type: Number, required: true },
    discountAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const CartSchema = new Schema<ICartDocument>(
  {
    cartId: { type: String, unique: true, index: true },
    guestId: { type: String, index: true },
    customerId: { type: String, index: true },
    items: { type: [CartItemSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    appliedOffer: { type: AppliedOfferSchema, default: null },
    taxAmount: { type: Number, default: 0, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    payableAmount: { type: Number, default: 0, min: 0 },
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

export const Cart =
  (mongoose.models.Cart as mongoose.Model<ICartDocument>) ||
  mongoose.model<ICartDocument>('Cart', CartSchema);

export default Cart;
