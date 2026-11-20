import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface IOrderItem {
  dishId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  image?: string;
}

export interface IOrderStatusHistoryItem {
  status: string;
  timestamp: string;
  actor: string;
  note?: string;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress?: string;
  fulfillmentType: 'dine-in' | 'pickup' | 'delivery';
  items: IOrderItem[];
  subtotal: number;
  taxAmount: number;
  deliveryCharge: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: 'online' | 'cod' | 'upi';
  paymentStatus: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
  orderStatus:
    | 'pending'
    | 'confirmed'
    | 'preparing'
    | 'ready_for_pickup'
    | 'out_for_delivery'
    | 'completed'
    | 'cancelled';
  notes?: string;
  statusHistory: IOrderStatusHistoryItem[];
  invoiceNumber: string;
  createdAt: string;
  updatedAt: string;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    dishId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    total: { type: Number, required: true },
    image: { type: String },
  },
  { _id: false }
);

const OrderStatusHistorySchema = new Schema<IOrderStatusHistoryItem>(
  {
    status: { type: String, required: true },
    timestamp: { type: String, required: true },
    actor: { type: String, required: true },
    note: { type: String },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>({
  id: { type: String, required: true, unique: true, index: true },
  orderNumber: { type: String, required: true, unique: true, index: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true, index: true },
  customerEmail: { type: String },
  deliveryAddress: { type: String },
  fulfillmentType: {
    type: String,
    enum: ['dine-in', 'pickup', 'delivery'],
    default: 'delivery',
  },
  items: { type: [OrderItemSchema], default: [] },
  subtotal: { type: Number, required: true },
  taxAmount: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['online', 'cod', 'upi'], default: 'cod' },
  paymentStatus: {
    type: String,
    enum: ['pending', 'authorized', 'paid', 'failed', 'refunded'],
    default: 'pending',
    index: true,
  },
  orderStatus: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'out_for_delivery',
      'completed',
      'cancelled',
    ],
    default: 'pending',
    index: true,
  },
  notes: { type: String },
  statusHistory: { type: [OrderStatusHistorySchema], default: [] },
  invoiceNumber: { type: String, required: true },
  createdAt: { type: String, required: true, index: true },
  updatedAt: { type: String, required: true },
});

applyCleanTransform(OrderSchema);

export const OrderModel: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
