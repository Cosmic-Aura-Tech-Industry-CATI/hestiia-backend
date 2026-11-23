import mongoose from 'mongoose';
import { Offer, type IOfferDocument } from './offer.model.js';
import type { IOffer, OfferValidationResult } from './offer.interface.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/index.js';

// Pre-seeded standard restaurant promotional offers
const initialOffers: IOffer[] = [
  {
    code: 'WELCOME10',
    title: 'First Dining Welcome Offer',
    description: 'Get 10% off on your order above ₹299 (Up to ₹150)',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscountAmount: 150,
    minOrderValue: 299,
    applicableFulfillment: ['delivery', 'dine-in', 'pickup'],
    displayOnBanner: true,
    bannerText: 'Use code WELCOME10 for 10% off on your dining order!',
    isActive: true,
    usedCount: 42,
    perUserLimit: 1,
  },
  {
    code: 'HESTIIA20',
    title: 'Fine Dining Feast 20% Off',
    description: 'Enjoy 20% off on premium dining orders above ₹999 (Up to ₹300)',
    discountType: 'percentage',
    discountValue: 20,
    maxDiscountAmount: 300,
    minOrderValue: 999,
    applicableFulfillment: ['delivery', 'dine-in', 'pickup'],
    displayOnBanner: true,
    bannerText: 'Royal Feast: 20% OFF on orders above ₹999 with code HESTIIA20',
    isActive: true,
    usedCount: 18,
    perUserLimit: 2,
  },
  {
    code: 'FLAT100',
    title: 'Flat ₹100 Off',
    description: 'Flat ₹100 discount on orders above ₹699',
    discountType: 'fixed',
    discountValue: 100,
    minOrderValue: 699,
    applicableFulfillment: ['delivery', 'dine-in', 'pickup'],
    displayOnBanner: false,
    isActive: true,
    usedCount: 25,
    perUserLimit: 1,
  },
  {
    code: 'FREESHIP',
    title: 'Complimentary Express Delivery',
    description: 'Free home delivery on all dining orders above ₹499',
    discountType: 'free_shipping',
    discountValue: 40,
    minOrderValue: 499,
    applicableFulfillment: ['delivery'],
    displayOnBanner: true,
    bannerText: 'Enjoy Free Delivery on orders above ₹499 with code FREESHIP',
    isActive: true,
    usedCount: 56,
    perUserLimit: 5,
  },
];

let fallbackOffersStore: any[] = [...initialOffers.map((o) => ({ id: 'off_' + o.code.toLowerCase(), ...o }))];

export const offersService = {
  /**
   * Retrieve active public promotional offers for checkout & diner discovery
   */
  async getPublicOffers(): Promise<any[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const now = new Date();
        const dbOffers = await Offer.find({
          isActive: true,
          $and: [
            { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
            { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] },
          ],
        })
          .sort({ minOrderValue: 1 })
          .lean();

        if (dbOffers && dbOffers.length > 0) return dbOffers;

        // Auto-seed Atlas if collection is empty
        await Offer.insertMany(initialOffers).catch(() => {});
        return initialOffers;
      } catch (err: any) {
        console.warn(`[OffersService] Mongo getPublicOffers error: ${err?.message}`);
      }
    }
    return fallbackOffersStore.filter((o) => o.isActive);
  },

  /**
   * Retrieve active banner announcements for homepage & checkout ribbons
   */
  async getBannerOffers(): Promise<any[]> {
    const publicOffers = await this.getPublicOffers();
    return publicOffers.filter((o) => o.displayOnBanner && o.bannerText);
  },

  /**
   * Retrieve all offers for admin management (active, expired, upcoming)
   */
  async getAdminOffers(query: any = {}): Promise<{
    offers: any[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
    counts: { total: number; active: number; inactive: number };
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (query.isActive !== undefined) {
          filter.isActive = query.isActive === 'true' || query.isActive === true;
        }
        if (query.search) {
          const regex = new RegExp(query.search.trim(), 'i');
          filter.$or = [{ code: regex }, { title: regex }, { description: regex }];
        }

        const [offers, total, activeCount, inactiveCount] = await Promise.all([
          Offer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
          Offer.countDocuments(filter),
          Offer.countDocuments({ isActive: true }),
          Offer.countDocuments({ isActive: false }),
        ]);

        return {
          offers,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
          },
          counts: { total, active: activeCount, inactive: inactiveCount },
        };
      } catch (err: any) {
        console.warn(`[OffersService] Mongo getAdminOffers error: ${err?.message}`);
      }
    }

    // In-memory fallback
    let items = [...fallbackOffersStore];
    if (query.isActive !== undefined) {
      const activeBool = query.isActive === 'true' || query.isActive === true;
      items = items.filter((o) => o.isActive === activeBool);
    }
    const total = items.length;

    return {
      offers: items.slice(skip, skip + limit),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      counts: {
        total: fallbackOffersStore.length,
        active: fallbackOffersStore.filter((o) => o.isActive).length,
        inactive: fallbackOffersStore.filter((o) => !o.isActive).length,
      },
    };
  },

  /**
   * Get single offer by coupon code
   */
  async getOfferByCode(code: string): Promise<any> {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) throw new BadRequestError('Coupon code is required');

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Offer.findOne({ code: cleanCode }).lean();
        if (doc) return doc;
      } catch {}
    }

    const memDoc = fallbackOffersStore.find((o) => o.code === cleanCode);
    if (!memDoc) throw new NotFoundError(`Offer code '${cleanCode}' not found`);
    return memDoc;
  },

  /**
   * Core Coupon Validation Engine: Checks rules & computes discount in Paise & Rupees
   */
  async validateAndCalculateDiscount(
    code: string,
    subtotalPaise: number,
    fulfillmentType = 'delivery'
  ): Promise<OfferValidationResult> {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) {
      throw new BadRequestError('Coupon code is required');
    }

    let offer: any = null;
    if (mongoose.connection.readyState === 1) {
      offer = await Offer.findOne({ code: cleanCode, isActive: true }).lean();
    }
    if (!offer) {
      offer = fallbackOffersStore.find((o) => o.code === cleanCode && o.isActive);
    }

    if (!offer) {
      throw new BadRequestError(`Coupon code '${cleanCode}' is invalid or expired.`);
    }

    const now = new Date();
    if (offer.startDate && new Date(offer.startDate) > now) {
      throw new BadRequestError(`Coupon code '${cleanCode}' is not active yet.`);
    }
    if (offer.endDate && new Date(offer.endDate) < now) {
      throw new BadRequestError(`Coupon code '${cleanCode}' has expired.`);
    }

    if (offer.usageLimit && offer.usedCount >= offer.usageLimit) {
      throw new BadRequestError(`Coupon code '${cleanCode}' has reached its maximum redemption limit.`);
    }

    const subtotalRupees = subtotalPaise / 100;
    if (offer.minOrderValue && subtotalRupees < offer.minOrderValue) {
      throw new BadRequestError(
        `Minimum order value for coupon '${cleanCode}' is ₹${offer.minOrderValue}. Your current subtotal is ₹${subtotalRupees.toFixed(
          2
        )}.`
      );
    }

    if (
      offer.applicableFulfillment &&
      offer.applicableFulfillment.length > 0 &&
      !offer.applicableFulfillment.includes(fulfillmentType)
    ) {
      throw new BadRequestError(
        `Coupon '${cleanCode}' is only valid for ${offer.applicableFulfillment.join(', ')} orders.`
      );
    }

    // Calculate exact discount in paise
    let discountPaise = 0;
    if (offer.discountType === 'percentage') {
      discountPaise = Math.round((subtotalPaise * offer.discountValue) / 100);
      if (offer.maxDiscountAmount) {
        discountPaise = Math.min(discountPaise, Math.round(offer.maxDiscountAmount * 100));
      }
    } else if (offer.discountType === 'fixed') {
      discountPaise = Math.min(subtotalPaise, Math.round(offer.discountValue * 100));
    } else if (offer.discountType === 'free_shipping') {
      discountPaise = Math.round((offer.discountValue || 40) * 100); // Delivery fee credit
    }

    const discountAmount = discountPaise / 100;

    return {
      valid: true,
      code: cleanCode,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      discountPaise,
      discountAmount,
      message: `Coupon '${cleanCode}' applied successfully! Savings of ₹${discountAmount.toFixed(2)}.`,
      offer,
    };
  },

  /**
   * Create a new promotional coupon offer (Staff / Admin)
   */
  async createOffer(offerData: Partial<IOffer>, _user?: any): Promise<any> {
    const code = String(offerData.code || '').trim().toUpperCase();
    const title = String(offerData.title || '').trim();
    const discountType = offerData.discountType || 'percentage';
    const discountValue = Number(offerData.discountValue);

    if (!code) throw new BadRequestError('Coupon code is required');
    if (!title) throw new BadRequestError('Offer title is required');
    if (isNaN(discountValue) || discountValue <= 0) {
      throw new BadRequestError('Discount value must be greater than zero');
    }

    const payload: Partial<IOffer> = {
      ...offerData,
      code,
      title,
      discountType,
      discountValue,
      usedCount: 0,
      isActive: offerData.isActive !== undefined ? Boolean(offerData.isActive) : true,
    };

    let createdDoc: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        createdDoc = await Offer.create(payload);
      } catch (err: any) {
        if (err.code === 11000) {
          throw new BadRequestError(`Coupon code '${code}' already exists`);
        }
        throw err;
      }
    }

    const memDoc = {
      id: 'off_' + code.toLowerCase(),
      ...payload,
      createdAt: new Date().toISOString(),
    };
    fallbackOffersStore.push(memDoc);

    return createdDoc || memDoc;
  },

  /**
   * Update existing coupon offer
   */
  async updateOffer(id: string, updateData: Partial<IOffer>, _user?: any): Promise<any> {
    const cleanId = String(id || '').trim();
    if (!cleanId) throw new BadRequestError('Offer ID is required');

    if (updateData.code) {
      updateData.code = updateData.code.trim().toUpperCase();
    }

    let updatedDoc: any = null;
    if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(cleanId)) {
      try {
        updatedDoc = await Offer.findByIdAndUpdate(cleanId, { $set: updateData }, { new: true }).lean();
      } catch (err: any) {
        console.warn(`[OffersService] Mongo updateOffer error: ${err?.message}`);
      }
    }

    const idx = fallbackOffersStore.findIndex((o) => o.id === cleanId || o.code === cleanId);
    if (idx !== -1) {
      fallbackOffersStore[idx] = { ...fallbackOffersStore[idx], ...updateData, updatedAt: new Date().toISOString() };
      if (!updatedDoc) updatedDoc = fallbackOffersStore[idx];
    }

    if (!updatedDoc) {
      throw new NotFoundError(`Offer #${cleanId} not found`);
    }

    return updatedDoc;
  },

  /**
   * Delete coupon offer
   */
  async deleteOffer(id: string): Promise<boolean> {
    const cleanId = String(id || '').trim();
    if (!cleanId) throw new BadRequestError('Offer ID is required');

    let deleted = false;
    if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(cleanId)) {
      const res = await Offer.findByIdAndDelete(cleanId);
      if (res) deleted = true;
    }

    const idx = fallbackOffersStore.findIndex((o) => o.id === cleanId || o.code === cleanId);
    if (idx !== -1) {
      fallbackOffersStore.splice(idx, 1);
      deleted = true;
    }

    if (!deleted) {
      throw new NotFoundError(`Offer #${cleanId} not found`);
    }
    return true;
  },

  /**
   * Increment coupon used count upon order checkout
   */
  async recordOfferUsage(code: string): Promise<void> {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return;

    if (mongoose.connection.readyState === 1) {
      await Offer.updateOne({ code: cleanCode }, { $inc: { usedCount: 1 } }).catch(() => {});
    }

    const memDoc = fallbackOffersStore.find((o) => o.code === cleanCode);
    if (memDoc) memDoc.usedCount = (memDoc.usedCount || 0) + 1;
  },

  /**
   * Offers marketing analytics
   */
  async getOffersStats(): Promise<any> {
    if (mongoose.connection.readyState === 1) {
      try {
        const [total, active, totalRedemptions] = await Promise.all([
          Offer.countDocuments(),
          Offer.countDocuments({ isActive: true }),
          Offer.aggregate([{ $group: { _id: null, total: { $sum: '$usedCount' } } }]),
        ]);

        return {
          totalOffers: total,
          activeOffers: active,
          totalRedemptions: totalRedemptions[0]?.total || 0,
        };
      } catch {}
    }

    return {
      totalOffers: fallbackOffersStore.length,
      activeOffers: fallbackOffersStore.filter((o) => o.isActive).length,
      totalRedemptions: fallbackOffersStore.reduce((sum, o) => sum + (o.usedCount || 0), 0),
    };
  },

  /**
   * Module health status
   */
  async getStatus() {
    return {
      module: 'offers',
      status: 'operational',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'fallback-store',
      offersCount: fallbackOffersStore.length,
      timestamp: new Date().toISOString(),
    };
  },
};

export default offersService;
