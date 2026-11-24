import { Document, Types } from 'mongoose';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type LoyaltyTransactionType =
  | 'earn'
  | 'redeem'
  | 'bonus'
  | 'tier_upgrade'
  | 'expire'
  | 'adjustment';

export interface ILoyaltyTierBenefit {
  tier: LoyaltyTier;
  minPoints: number;
  multiplier: number;
  discountPercent: number;
  perks: string[];
}

export interface ILoyaltyAccount {
  customerId?: Types.ObjectId | string;
  phone: string;
  customerName?: string;
  email?: string;
  tier: LoyaltyTier;
  currentPoints: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
  referralCode: string;
  referredBy?: string;
  tierExpiresAt?: Date;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILoyaltyAccountDocument extends ILoyaltyAccount, Document {
  id: string;
}

export interface ILoyaltyTransaction {
  loyaltyAccountId?: Types.ObjectId | string;
  phone: string;
  orderNumber?: string;
  type: LoyaltyTransactionType;
  points: number; // Positive for earn/bonus, negative for redeem
  balanceAfter: number;
  description: string;
  metadata?: any;
  performedBy?: string;
  createdAt?: Date;
}

export interface ILoyaltyTransactionDocument extends ILoyaltyTransaction, Document {
  id: string;
}

export interface IRewardVoucher {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  rewardType: 'discount_fixed' | 'discount_percent' | 'free_item';
  discountValue: number;
  minOrderValue?: number;
  codePrefix: string;
  isActive: boolean;
}
