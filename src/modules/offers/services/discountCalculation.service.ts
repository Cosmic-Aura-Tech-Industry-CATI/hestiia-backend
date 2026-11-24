import { AppError } from '../../../shared/utils/appError.js';
import { IOffer } from '../interfaces/offer.interface.js';

export interface IDiscountCalculationResult {
  eligibleSubtotal: number;
  discountAmount: number;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  payableAmount: number;
}

export const discountCalculationService = {
  /**
   * Calculate discount amount deterministically based on offer rules and subtotal
   */
  calculateDiscount(offer: IOffer, eligibleSubtotal: number): IDiscountCalculationResult {
    const subtotal = Math.max(0, Number(eligibleSubtotal) || 0);

    // 1. Validate minimum order requirements
    const minOrder = Number(offer.minOrderValue) || 0;
    if (subtotal < minOrder) {
      throw new AppError(
        `Order subtotal of ₹${subtotal.toFixed(2)} does not meet the minimum requirement of ₹${minOrder.toFixed(2)} for this offer.`,
        400
      );
    }

    let discount = 0;

    if (offer.discountType === 'fixed') {
      discount = Math.min(Number(offer.discountValue), subtotal);
    } else if (offer.discountType === 'percentage') {
      const percentage = Number(offer.discountValue);
      let calculated = (subtotal * percentage) / 100;

      // Apply maximum discount cap if configured
      if (offer.maxDiscount !== null && offer.maxDiscount !== undefined && offer.maxDiscount > 0) {
        calculated = Math.min(calculated, Number(offer.maxDiscount));
      }

      discount = Math.min(calculated, subtotal);
    } else {
      throw new AppError(`Unsupported discount type: ${(offer as any).discountType}`, 400);
    }

    // Currency safe rounding to 2 decimal places
    discount = Math.round(discount * 100) / 100;
    discount = Math.max(0, Math.min(discount, subtotal));

    const payable = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

    return {
      eligibleSubtotal: subtotal,
      discountAmount: discount,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      payableAmount: payable,
    };
  },

  /**
   * Helper to verify if an offer is currently valid and active
   */
  isOfferAvailable(offer: IOffer, checkDate = new Date()): { available: boolean; reason?: string } {
    if (!offer.isActive) {
      return { available: false, reason: 'Offer is currently inactive' };
    }
    if (offer.isArchived) {
      return { available: false, reason: 'Offer has been archived' };
    }

    const now = checkDate.getTime();
    const start = new Date(offer.startDate).getTime();
    const end = new Date(offer.endDate).getTime();

    if (now < start) {
      return { available: false, reason: 'Offer is scheduled for a future date' };
    }
    if (now > end) {
      return { available: false, reason: 'Offer has expired' };
    }

    return { available: true };
  },
};

export default discountCalculationService;
