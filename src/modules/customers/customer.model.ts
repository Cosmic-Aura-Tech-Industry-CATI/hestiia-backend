import mongoose, { Schema, Model } from 'mongoose';
import { ICustomerDocument } from './customer.interface.js';

export type { ICustomerDocument } from './customer.interface.js';

export interface ICustomerModel extends Model<ICustomerDocument> {}

const customerSchema = new Schema<ICustomerDocument>(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Customer name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    totalOrders: {
      type: Number,
      default: 0,
      min: [0, 'Total orders cannot be negative'],
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: [0, 'Total spent cannot be negative'],
    },
    lastOrderDate: {
      type: Date,
      default: null,
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
customerSchema.index({ phone: 1 }, { unique: true });
customerSchema.index({ totalSpent: -1, createdAt: -1 });
customerSchema.index({ totalOrders: -1, createdAt: -1 });
customerSchema.index({ lastOrderDate: -1 });
customerSchema.index({ createdAt: -1 });
customerSchema.index({ name: 'text', email: 'text', phone: 'text' });

export const Customer =
  (mongoose.models.Customer as ICustomerModel) ||
  mongoose.model<ICustomerDocument, ICustomerModel>('Customer', customerSchema);
