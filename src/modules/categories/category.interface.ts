import { Document, Types } from 'mongoose';

export interface ICategory {
  _id?: Types.ObjectId;
  id?: string;
  name: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICategoryDocument extends Document {
  name: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
