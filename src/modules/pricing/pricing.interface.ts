import { Document } from 'mongoose';

export type PricingRuleType = 'tax' | 'surge' | 'happy_hour' | 'packaging' | 'service_charge';

export interface IPricingRule {
  name: string;
  ruleType: PricingRuleType;
  description?: string;
  rate: number;
  isPercentage: boolean;
  applicableFulfillment: ('delivery' | 'dine-in' | 'pickup')[];
  minOrderValue?: number;
  timeWindow?: {
    startHour: number;
    endHour: number;
    daysOfWeek: number[];
  };
  isActive: boolean;
  priority: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPricingRuleDocument extends IPricingRule, Document {
  id: string;
}

export interface BillQuoteItem {
  dishId?: string;
  name: string;
  price: number;
  quantity: number;
}

export interface BillQuoteRequest {
  items: BillQuoteItem[];
  fulfillmentType?: 'delivery' | 'dine-in' | 'pickup';
  couponCode?: string;
  pincode?: string;
  loyaltyPointsToRedeem?: number;
}

export interface BillQuoteBreakdown {
  subtotal: number;
  subtotalPaise: number;
  packagingCharge: number;
  packagingChargePaise: number;
  deliveryFee: number;
  deliveryFeePaise: number;
  discount: number;
  discountPaise: number;
  appliedCoupon?: string;
  taxableAmount: number;
  taxableAmountPaise: number;
  cgst: number;
  cgstPaise: number;
  sgst: number;
  sgstPaise: number;
  totalTax: number;
  totalTaxPaise: number;
  serviceCharge: number;
  serviceChargePaise: number;
  roundOff: number;
  grandTotal: number;
  grandTotalPaise: number;
  currency: string;
  currencySymbol: string;
  itemCount: number;
}
