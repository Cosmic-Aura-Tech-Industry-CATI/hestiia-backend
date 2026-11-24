import { Document } from 'mongoose';

export type OfferDiscountType = 'percentage' | 'fixed' | 'free_shipping';

export interface IOffer {
  code: string;
  title: string;
  description?: string;
  discountType: OfferDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderValue: number;
  startDate?: Date;
  endDate?: Date;
  usageLimit?: number;
  usedCount: number;
  perUserLimit: number;
  applicableFulfillment: ('delivery' | 'dine-in' | 'pickup')[];
  displayOnBanner: boolean;
  bannerText?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOfferDocument extends IOffer, Document {
  id: string;
}

export interface OfferValidationResult {
  valid: boolean;
  code: string;
  discountType: OfferDiscountType;
  discountValue: number;
  discountPaise: number;
  discountAmount: number;
  message: string;
  offer?: Partial<IOffer>;
}
