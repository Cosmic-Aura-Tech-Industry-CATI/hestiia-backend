import mongoose, { Schema, Model } from 'mongoose';
import { IPricingRuleDocument } from './pricing.interface.js';

export type { IPricingRuleDocument } from './pricing.interface.js';

export interface IPricingRuleModel extends Model<IPricingRuleDocument> {}

const pricingRuleSchema = new Schema<IPricingRuleDocument>(
  {
    name: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true,
      maxlength: [100, 'Rule name cannot exceed 100 characters'],
    },
    ruleType: {
      type: String,
      enum: ['tax', 'surge', 'happy_hour', 'packaging', 'service_charge'],
      required: [true, 'Rule type is required'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    rate: {
      type: Number,
      required: [true, 'Rate is required'],
      min: [0, 'Rate cannot be negative'],
    },
    isPercentage: {
      type: Boolean,
      default: true,
    },
    applicableFulfillment: {
      type: [String],
      enum: ['delivery', 'dine-in', 'pickup'],
      default: ['delivery', 'dine-in', 'pickup'],
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },
    timeWindow: {
      startHour: { type: Number, min: 0, max: 23 },
      endHour: { type: Number, min: 0, max: 23 },
      daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 10,
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

pricingRuleSchema.index({ ruleType: 1, isActive: 1 });
pricingRuleSchema.index({ isActive: 1, priority: 1 });

export const PricingRule =
  (mongoose.models.PricingRule as IPricingRuleModel) ||
  mongoose.model<IPricingRuleDocument, IPricingRuleModel>('PricingRule', pricingRuleSchema);

export default PricingRule;
