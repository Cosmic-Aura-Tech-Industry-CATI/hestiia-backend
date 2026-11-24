import mongoose from 'mongoose';
import { PricingRule, type IPricingRuleDocument } from './pricing.model.js';
import { Setting } from '../settings/setting.model.js';
import { offersService } from '../offers/offers.service.js';
import { deliveryService } from '../delivery/delivery.service.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/index.js';
import type {
  IPricingRule,
  BillQuoteRequest,
  BillQuoteBreakdown,
} from './pricing.interface.js';

// Pre-seeded standard restaurant pricing & tax rules
const defaultPricingRules: IPricingRule[] = [
  {
    name: 'Central GST (CGST)',
    ruleType: 'tax',
    description: 'Central Goods & Services Tax (2.5%)',
    rate: 2.5,
    isPercentage: true,
    applicableFulfillment: ['delivery', 'dine-in', 'pickup'],
    isActive: true,
    priority: 1,
  },
  {
    name: 'State GST (SGST)',
    ruleType: 'tax',
    description: 'State Goods & Services Tax (2.5%)',
    rate: 2.5,
    isPercentage: true,
    applicableFulfillment: ['delivery', 'dine-in', 'pickup'],
    isActive: true,
    priority: 2,
  },
  {
    name: 'Eco-Friendly Food Packaging',
    ruleType: 'packaging',
    description: 'Tamper-evident bio-degradable meal container packaging fee',
    rate: 25,
    isPercentage: false,
    applicableFulfillment: ['delivery', 'pickup'],
    isActive: true,
    priority: 5,
  },
  {
    name: 'Discretionary Hospitality Service Charge',
    ruleType: 'service_charge',
    description: 'Fine dining staff gratuity & hospitality fee for table service',
    rate: 5,
    isPercentage: true,
    applicableFulfillment: ['dine-in'],
    isActive: false, // Optional / toggled by restaurant manager
    priority: 8,
  },
];

let fallbackRulesStore: any[] = [
  ...defaultPricingRules.map((r, i) => ({ id: 'rule_' + (i + 1), ...r })),
];

export const pricingService = {
  /**
   * Universal Bill Calculation Engine
   * Computes subtotal, taxes (CGST/SGST), packaging, delivery, discounts, and roundoff
   */
  async calculateBillQuote(req: BillQuoteRequest): Promise<BillQuoteBreakdown> {
    if (!req.items || !Array.isArray(req.items) || req.items.length === 0) {
      throw new BadRequestError('Items array cannot be empty for quote calculation');
    }

    const fulfillmentType = req.fulfillmentType || 'delivery';

    // 1. Calculate Gross Subtotal in Integer Paise
    let subtotalPaise = 0;
    let itemCount = 0;
    for (const item of req.items) {
      const price = Math.max(0, Number(item.price) || 0);
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      subtotalPaise += Math.round(price * 100) * qty;
      itemCount += qty;
    }

    // 2. Packaging Surcharge (Delivery and Takeaway orders)
    let packagingPaise = 0;
    if (['delivery', 'pickup'].includes(fulfillmentType)) {
      packagingPaise = Math.round(25 * 100); // Standard ₹25 packaging
    }

    // 3. Promotional Coupon / Discount Calculation
    let discountPaise = 0;
    let appliedCoupon: string | undefined = undefined;

    if (req.couponCode && req.couponCode.trim()) {
      try {
        const offerResult = await offersService.validateAndCalculateDiscount(
          req.couponCode.trim(),
          subtotalPaise,
          fulfillmentType
        );
        discountPaise = offerResult.discountPaise;
        appliedCoupon = offerResult.code;
      } catch (err: any) {
        throw new BadRequestError(err.message || 'Invalid coupon applied');
      }
    }

    // 4. Loyalty Points Redemption Discount (1 point = ₹0.50 = 50 paise)
    if (req.loyaltyPointsToRedeem && req.loyaltyPointsToRedeem > 0) {
      const loyaltyDiscountPaise = Math.round(req.loyaltyPointsToRedeem * 50);
      discountPaise += loyaltyDiscountPaise;
    }

    // Ensure discount does not exceed subtotal + packaging
    discountPaise = Math.min(subtotalPaise + packagingPaise, discountPaise);

    // 5. Delivery Fee Calculation
    let deliveryFeePaise = 0;
    if (fulfillmentType === 'delivery') {
      let baseFee = 40;
      if (req.pincode) {
        try {
          const serviceability = await deliveryService.checkServiceability(req.pincode);
          if (serviceability.serviceable) {
            baseFee = serviceability.deliveryFee;
          }
        } catch {}
      } else {
        try {
          if (mongoose.connection.readyState === 1) {
            const settings = await Setting.findOne().lean();
            if (settings?.deliveryFee !== undefined) {
              baseFee = settings.deliveryFee;
            }
          }
        } catch {}
      }
      deliveryFeePaise = Math.round(baseFee * 100);
    }

    // 6. Taxable Base Calculation
    const taxablePaise = Math.max(0, subtotalPaise + packagingPaise - discountPaise);

    // 7. Taxes: CGST (2.5%) & SGST (2.5%) = 5% Total GST
    const cgstPaise = Math.round((taxablePaise * 2.5) / 100);
    const sgstPaise = Math.round((taxablePaise * 2.5) / 100);
    const totalTaxPaise = cgstPaise + sgstPaise;

    // 8. Service Charge (Dine-in only if enabled)
    let serviceChargePaise = 0;
    if (fulfillmentType === 'dine-in') {
      const activeRules = await this.getActiveRules();
      const scRule = activeRules.find((r) => r.ruleType === 'service_charge' && r.isActive);
      if (scRule) {
        serviceChargePaise = Math.round((taxablePaise * scRule.rate) / 100);
      }
    }

    // 9. Grand Total & Mathematical Roundoff
    const rawTotalPaise = taxablePaise + totalTaxPaise + deliveryFeePaise + serviceChargePaise;
    const roundedRupees = Math.round(rawTotalPaise / 100);
    const finalGrandTotalPaise = roundedRupees * 100;
    const roundOffRupees = roundedRupees - rawTotalPaise / 100;

    return {
      subtotal: subtotalPaise / 100,
      subtotalPaise,
      packagingCharge: packagingPaise / 100,
      packagingChargePaise: packagingPaise,
      deliveryFee: deliveryFeePaise / 100,
      deliveryFeePaise,
      discount: discountPaise / 100,
      discountPaise,
      appliedCoupon,
      taxableAmount: taxablePaise / 100,
      taxableAmountPaise: taxablePaise,
      cgst: cgstPaise / 100,
      cgstPaise,
      sgst: sgstPaise / 100,
      sgstPaise,
      totalTax: totalTaxPaise / 100,
      totalTaxPaise,
      serviceCharge: serviceChargePaise / 100,
      serviceChargePaise,
      roundOff: Number(roundOffRupees.toFixed(2)),
      grandTotal: roundedRupees,
      grandTotalPaise: finalGrandTotalPaise,
      currency: 'INR',
      currencySymbol: '₹',
      itemCount,
    };
  },

  /**
   * Retrieve active pricing and tax rules
   */
  async getActiveRules(): Promise<IPricingRule[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const rules = await PricingRule.find({ isActive: true }).sort({ priority: 1 }).lean();
        if (rules && rules.length > 0) return rules;

        // Auto-seed Atlas if collection is fresh
        await PricingRule.insertMany(defaultPricingRules).catch(() => {});
        return defaultPricingRules;
      } catch (err: any) {
        console.warn(`[PricingService] Mongo getActiveRules error: ${err?.message}`);
      }
    }
    return fallbackRulesStore.filter((r) => r.isActive);
  },

  /**
   * Retrieve all rules for admin configuration
   */
  async getAllRules(): Promise<IPricingRule[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const rules = await PricingRule.find().sort({ priority: 1 }).lean();
        if (rules && rules.length > 0) return rules;
      } catch {}
    }
    return fallbackRulesStore;
  },

  /**
   * Create a new pricing / tax rule (Superadmin / Manager)
   */
  async createRule(ruleData: Partial<IPricingRule>): Promise<any> {
    const name = String(ruleData.name || '').trim();
    if (!name) throw new BadRequestError('Rule name is required');
    if (!ruleData.ruleType) throw new BadRequestError('Rule type is required');
    if (ruleData.rate === undefined || isNaN(Number(ruleData.rate))) {
      throw new BadRequestError('Valid rule rate is required');
    }

    const payload: Partial<IPricingRule> = {
      ...ruleData,
      name,
      rate: Number(ruleData.rate),
      isActive: ruleData.isActive !== undefined ? Boolean(ruleData.isActive) : true,
      priority: Number(ruleData.priority) || 10,
    };

    let doc: any = null;
    if (mongoose.connection.readyState === 1) {
      doc = await PricingRule.create(payload);
    }

    const memDoc = {
      id: 'rule_' + Date.now(),
      ...payload,
      createdAt: new Date().toISOString(),
    };
    fallbackRulesStore.push(memDoc);

    return doc || memDoc;
  },

  /**
   * Update existing pricing rule
   */
  async updateRule(id: string, updateData: Partial<IPricingRule>): Promise<any> {
    const cleanId = String(id || '').trim();
    if (!cleanId) throw new BadRequestError('Rule ID is required');

    let updatedDoc: any = null;
    if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(cleanId)) {
      updatedDoc = await PricingRule.findByIdAndUpdate(cleanId, { $set: updateData }, { new: true }).lean();
    }

    const idx = fallbackRulesStore.findIndex((r) => r.id === cleanId);
    if (idx !== -1) {
      fallbackRulesStore[idx] = { ...fallbackRulesStore[idx], ...updateData, updatedAt: new Date().toISOString() };
      if (!updatedDoc) updatedDoc = fallbackRulesStore[idx];
    }

    if (!updatedDoc) throw new NotFoundError(`Pricing rule #${cleanId} not found`);
    return updatedDoc;
  },

  /**
   * Delete pricing rule
   */
  async deleteRule(id: string): Promise<boolean> {
    const cleanId = String(id || '').trim();
    if (!cleanId) throw new BadRequestError('Rule ID is required');

    let deleted = false;
    if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(cleanId)) {
      const res = await PricingRule.findByIdAndDelete(cleanId);
      if (res) deleted = true;
    }

    const idx = fallbackRulesStore.findIndex((r) => r.id === cleanId);
    if (idx !== -1) {
      fallbackRulesStore.splice(idx, 1);
      deleted = true;
    }

    if (!deleted) throw new NotFoundError(`Pricing rule #${cleanId} not found`);
    return true;
  },

  /**
   * Instant tax estimation helper
   */
  getTaxEstimate(amount: number): { taxableAmount: number; cgst: number; sgst: number; totalTax: number } {
    const amt = Math.max(0, Number(amount) || 0);
    const cgst = Number(((amt * 2.5) / 100).toFixed(2));
    const sgst = Number(((amt * 2.5) / 100).toFixed(2));
    return {
      taxableAmount: amt,
      cgst,
      sgst,
      totalTax: Number((cgst + sgst).toFixed(2)),
    };
  },

  /**
   * Module health status
   */
  async getStatus() {
    return {
      module: 'pricing',
      status: 'operational',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'fallback-store',
      gstRate: '5% (2.5% CGST + 2.5% SGST)',
      timestamp: new Date().toISOString(),
    };
  },
};

export default pricingService;
