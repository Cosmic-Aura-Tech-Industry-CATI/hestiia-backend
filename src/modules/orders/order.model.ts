import mongoose, { Schema, Model } from 'mongoose';
import { IOrderDocument } from './orders.interface.js';

export type { IOrderDocument } from './orders.interface.js';

export interface IOrderModel extends Model<IOrderDocument> {}

const orderItemSchema = new Schema(
  {
    dishId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    priceInPaise: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true, min: 0 },
    totalInPaise: { type: Number, min: 0 },
    image: { type: String, default: '/uploads/menu/default-dish.webp' },
  },
  { _id: false }
);

const statusHistorySchema = new Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    actor: { type: String, default: 'System' },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const orderOfferSnapshotSchema = new Schema(
  {
    offerId: { type: String, trim: true },
    title: { type: String, trim: true },
    discountType: { type: String, enum: ['fixed', 'percentage'] },
    discountValue: { type: Number },
    discountAmount: { type: Number },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrderDocument>(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      trim: true,
      unique: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerPhone: {
      type: String,
      required: [true, 'Customer phone number is required'],
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    deliveryAddress: {
      type: String,
      trim: true,
      default: '',
    },
    fulfillmentType: {
      type: String,
      enum: ['dine-in', 'pickup', 'delivery'],
      default: 'delivery',
    },
    items: {
      type: [orderItemSchema],
      required: [true, 'Order items are required'],
      validate: [(val: any[]) => val && val.length > 0, 'At least one item is required in the order'],
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },
    subtotalInPaise: { type: Number, min: 0 },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tax amount cannot be negative'],
    },
    taxInPaise: { type: Number, min: 0 },
    deliveryCharge: {
      type: Number,
      default: 0,
      min: [0, 'Delivery charge cannot be negative'],
    },
    deliveryInPaise: { type: Number, min: 0 },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative'],
    },
    discountInPaise: { type: Number, min: 0 },
    offer: {
      type: orderOfferSnapshotSchema,
      default: null,
    },
    grandTotal: {
      type: Number,
      required: [true, 'Grand total is required'],
      min: [0, 'Grand total cannot be negative'],
    },
    grandTotalInPaise: { type: Number, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['online', 'cod', 'upi'],
      default: 'cod',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'authorized', 'paid', 'failed', 'refunded', 'awaiting_verification'],
      default: 'pending',
    },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'],
      default: 'pending',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    cancellationReason: { type: String, trim: true },
    cancelledAt: { type: String },
    cancelledBy: { type: String, trim: true },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
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

// High-performance query indexes
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ customerPhone: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ fulfillmentType: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderNumber: 'text', customerName: 'text', customerPhone: 'text', invoiceNumber: 'text' });

export const Order =
  (mongoose.models.Order as IOrderModel) ||
  mongoose.model<IOrderDocument, IOrderModel>('Order', orderSchema);
