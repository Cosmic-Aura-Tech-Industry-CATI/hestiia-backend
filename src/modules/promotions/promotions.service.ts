import mongoose from 'mongoose';
import { db } from '../../shared/config/db.js';
import { Promotion, type IPromotionDocument } from './promotion.model.js';
import { AppError } from '../../shared/utils/appError.js';

export const promotionsService = {
  async getPublicPromotions() {
    if (mongoose.connection.readyState === 1) {
      try {
        const promotions = await Promotion.find({ isActive: true })
          .sort({ displayOrder: 1, createdAt: -1 })
          .lean();
        if (promotions.length > 0) return promotions;
      } catch {}
    }
    return [...db.getState().promotions]
      .filter((p) => p.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  },

  async getAdminPromotions() {
    if (mongoose.connection.readyState === 1) {
      try {
        const promotions = await Promotion.find()
          .sort({ displayOrder: 1, createdAt: -1 })
          .lean();
        if (promotions.length > 0) return promotions;
      } catch {}
    }
    return [...db.getState().promotions].sort((a, b) => a.displayOrder - b.displayOrder);
  },

  async createPromotion(data: any, username = 'admin') {
    const { title, subtitle, price, originalPrice, serves, badge, items, image, startDate, endDate, isActive = true } = data;

    if (!title || price === undefined) {
      throw new AppError('Offer title and price are required.', 400);
    }

    const parsedItems = Array.isArray(items)
      ? items
      : String(items || '').split('\n').map((s: string) => s.trim()).filter(Boolean);

    let createdPromo: any = null;

    if (mongoose.connection.readyState === 1) {
      try {
        createdPromo = await Promotion.create({
          title: title.trim(),
          subtitle: (subtitle || '').trim(),
          price: Number(price),
          originalPrice: originalPrice ? Number(originalPrice) : Number(price),
          serves: (serves || '2 Guests').trim(),
          badge: (badge || 'Special Offer').trim(),
          items: parsedItems,
          image: image || '/images/dishes/handi-paneer.jpg',
          startDate,
          endDate,
          isActive: Boolean(isActive),
          displayOrder: (await Promotion.countDocuments()) + 1,
        });
      } catch (err: any) {
        console.warn(`[Promotion] MongoDB create failed: ${err?.message}`);
      }
    }

    const id = createdPromo?._id ? String(createdPromo._id) : 'promo-' + Date.now();
    const newPromo = {
      id,
      title: title.trim(),
      subtitle: (subtitle || '').trim(),
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : Number(price),
      serves: (serves || '2 Guests').trim(),
      badge: (badge || 'Special Offer').trim(),
      items: parsedItems,
      image: image || '/images/dishes/handi-paneer.jpg',
      startDate,
      endDate,
      isActive: Boolean(isActive),
      displayOrder: db.getState().promotions.length + 1,
    };

    db.updateState((s) => s.promotions.push(newPromo as any));
    db.logAudit('CREATE_PROMOTION', username, `Created dining offer: ${newPromo.title}`);

    return createdPromo || newPromo;
  },

  async updatePromotion(promoId: string, data: any, username = 'admin') {
    const { title, subtitle, price, originalPrice, serves, badge, items, image, startDate, endDate, isActive, displayOrder } = data;

    let updatedDoc: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const updatePayload: any = {};
        if (title) updatePayload.title = title.trim();
        if (subtitle !== undefined) updatePayload.subtitle = subtitle.trim();
        if (price !== undefined) updatePayload.price = Number(price);
        if (originalPrice !== undefined) updatePayload.originalPrice = Number(originalPrice);
        if (serves !== undefined) updatePayload.serves = serves.trim();
        if (badge !== undefined) updatePayload.badge = badge.trim();
        if (items !== undefined) {
          updatePayload.items = Array.isArray(items) ? items : String(items).split('\n').map((s: string) => s.trim()).filter(Boolean);
        }
        if (image) updatePayload.image = image;
        if (startDate !== undefined) updatePayload.startDate = startDate;
        if (endDate !== undefined) updatePayload.endDate = endDate;
        if (isActive !== undefined) updatePayload.isActive = Boolean(isActive);
        if (displayOrder !== undefined) updatePayload.displayOrder = Number(displayOrder);

        if (mongoose.Types.ObjectId.isValid(promoId)) {
          updatedDoc = await Promotion.findByIdAndUpdate(promoId, updatePayload, { new: true });
        }
      } catch {}
    }

    let updated: any = updatedDoc;
    db.updateState((s) => {
      const target = s.promotions.find((p) => p.id === promoId);
      if (target) {
        if (title) target.title = title.trim();
        if (subtitle !== undefined) target.subtitle = subtitle.trim();
        if (price !== undefined) target.price = Number(price);
        if (originalPrice !== undefined) target.originalPrice = Number(originalPrice);
        if (serves !== undefined) target.serves = serves.trim();
        if (badge !== undefined) target.badge = badge.trim();
        if (items !== undefined) {
          target.items = Array.isArray(items) ? items : String(items).split('\n').map((s: string) => s.trim()).filter(Boolean);
        }
        if (image) target.image = image;
        if (startDate !== undefined) target.startDate = startDate;
        if (endDate !== undefined) target.endDate = endDate;
        if (isActive !== undefined) target.isActive = Boolean(isActive);
        if (displayOrder !== undefined) target.displayOrder = Number(displayOrder);
        if (!updated) updated = { ...target };
      }
    });

    if (!updated) {
      throw new AppError('Dining offer not found.', 404);
    }

    db.logAudit('UPDATE_PROMOTION', username, `Updated offer: ${updated.title}`);
    return updated;
  },

  async deletePromotion(promoId: string, username = 'admin') {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(promoId)) {
      await Promotion.findByIdAndDelete(promoId).catch(() => {});
    }

    let deleted = false;
    db.updateState((s) => {
      const initialLen = s.promotions.length;
      s.promotions = s.promotions.filter((p) => p.id !== promoId);
      if (s.promotions.length < initialLen) deleted = true;
    });

    db.logAudit('DELETE_PROMOTION', username, `Removed dining offer ${promoId}`);
    return { success: true };
  },
};

export default promotionsService;
