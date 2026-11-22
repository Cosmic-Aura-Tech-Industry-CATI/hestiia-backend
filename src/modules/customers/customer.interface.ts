import { Document, Types } from 'mongoose';

export interface ICustomer {
  _id?: Types.ObjectId;
  id?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ICustomerDocument extends Document {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
