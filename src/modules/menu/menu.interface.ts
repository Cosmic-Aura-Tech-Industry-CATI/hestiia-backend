import { Document, Types } from 'mongoose';

export interface IFoodItem {
  _id?: Types.ObjectId;
  id?: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  fullDescription?: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  isVeg: boolean;
  isSignature?: boolean;
  spiceLevel: 1 | 2 | 3;
  preparationTime: string;
  ingredients: string[];
  chefNote?: string;
  available: boolean;
  displayOrder?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface IFoodItemDocument extends Document {
  name: string;
  slug: string;
  category: string;
  description: string;
  fullDescription?: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  isVeg: boolean;
  isSignature?: boolean;
  spiceLevel: 1 | 2 | 3;
  preparationTime: string;
  ingredients: string[];
  chefNote?: string;
  available: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
