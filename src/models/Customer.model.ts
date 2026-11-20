import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface ICustomer {
  id: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  createdAt: string;
}

const CustomerSchema = new Schema<ICustomer>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  phone: { type: String, required: true, index: true },
  normalizedPhone: { type: String, required: true, unique: true, index: true },
  email: { type: String },
  totalOrders: { type: Number, default: 1 },
  totalSpent: { type: Number, default: 0 },
  lastOrderDate: { type: String, required: true },
  createdAt: { type: String, required: true },
});

applyCleanTransform(CustomerSchema);

export const CustomerModel: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);
