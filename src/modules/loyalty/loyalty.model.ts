import mongoose, { Schema, Model } from 'mongoose';
import {
  ILoyaltyAccountDocument,
  ILoyaltyTransactionDocument,
} from './loyalty.interface.js';

export type { ILoyaltyAccountDocument, ILoyaltyTransactionDocument } from './loyalty.interface.js';

export interface ILoyaltyAccountModel extends Model<ILoyaltyAccountDocument> {}
export interface ILoyaltyTransactionModel extends Model<ILoyaltyTransactionDocument> {}

// 1. Loyalty Account Schema
const loyaltyAccountSchema = new Schema<ILoyaltyAccountDocument>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
    },
    phone: {
      type: String,
      required: [true, 'Customer phone number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum'],
      default: 'bronze',
    },
    currentPoints: {
      type: Number,
      default: 0,
      min: [0, 'Points balance cannot be negative'],
    },
    lifetimePointsEarned: {
      type: Number,
      default: 0,
      min: [0, 'Lifetime points cannot be negative'],
    },
    lifetimePointsRedeemed: {
      type: Number,
      default: 0,
      min: [0, 'Lifetime redeemed cannot be negative'],
    },
    referralCode: {
      type: String,
      trim: true,
      default: '',
    },
    referredBy: {
      type: String,
      trim: true,
      default: '',
    },
    tierExpiresAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// High-performance compound indexes for loyalty lookups
loyaltyAccountSchema.index({ tier: 1, currentPoints: -1 });
loyaltyAccountSchema.index({ referralCode: 1 }, { sparse: true });

// 2. Loyalty Transactions Ledger Schema
const loyaltyTransactionSchema = new Schema<ILoyaltyTransactionDocument>(
  {
    loyaltyAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'LoyaltyAccount',
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    orderNumber: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['earn', 'redeem', 'bonus', 'tier_upgrade', 'expire', 'adjustment'],
      required: true,
    },
    points: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    performedBy: {
      type: String,
      trim: true,
      default: 'system',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

loyaltyTransactionSchema.index({ phone: 1, createdAt: -1 });
loyaltyTransactionSchema.index({ orderNumber: 1 });

export const LoyaltyAccount =
  (mongoose.models.LoyaltyAccount as ILoyaltyAccountModel) ||
  mongoose.model<ILoyaltyAccountDocument, ILoyaltyAccountModel>('LoyaltyAccount', loyaltyAccountSchema);

export const LoyaltyTransaction =
  (mongoose.models.LoyaltyTransaction as ILoyaltyTransactionModel) ||
  mongoose.model<ILoyaltyTransactionDocument, ILoyaltyTransactionModel>(
    'LoyaltyTransaction',
    loyaltyTransactionSchema
  );

export default LoyaltyAccount;
