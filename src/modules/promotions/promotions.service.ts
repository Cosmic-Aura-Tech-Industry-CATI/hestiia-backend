import { db, Promotion } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';

export const promotionsService = {
  async getPublicPromotions() {
    const promotions = [...db.getState().promotions]
      .filter((p) => p.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    return promotions;
  },

  async getAdminPromotions() {
    return [...db.getState().promotions].sort((a, b) => a.displayOrder - b.displayOrder);
  },

  async createPromotion(data: any, username = 'admin') {
    const { title, subtitle, price, originalPrice, serves, badge, items, image, startDate, endDate, isActive = true } = data;

    if (!title || price === undefined) {
      throw new AppError('Offer title and price are required.', 400);
    }

    const id = 'promo-' + Date.now();
    const newPromo: Promotion = {
      id,
      title: title.trim(),
      subtitle: (subtitle || '').trim(),
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : Number(price),
      serves: (serves || '2 Guests').trim(),
      badge: (badge || 'Special Offer').trim(),
      items: Array.isArray(items) ? items : String(items || '').split('\n').map((s: string) => s.trim()).filter(Boolean),
      image: image || '/images/dishes/handi-paneer.jpg',
      startDate,
      endDate,
      isActive: Boolean(isActive),
      displayOrder: db.getState().promotions.length + 1,
    };

    db.updateState((s) => s.promotions.push(newPromo));
    db.logAudit('CREATE_PROMOTION', username, `Created dining offer: ${newPromo.title}`);

    return newPromo;
  },

  async updatePromotion(promoId: string, data: any, username = 'admin') {
    const { title, subtitle, price, originalPrice, serves, badge, items, image, startDate, endDate, isActive, displayOrder } = data;

    let updated: Promotion | null = null;
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
        updated = { ...target };
      }
    });

    if (!updated) {
      throw new AppError('Promotion offer not found.', 404);
    }

    db.logAudit('UPDATE_PROMOTION', username, `Updated promotion: ${(updated as Promotion).title}`);
    return updated;
  },

  async deletePromotion(promoId: string, username = 'admin') {
    db.updateState((s) => {
      s.promotions = s.promotions.filter((p) => p.id !== promoId);
    });
    db.logAudit('DELETE_PROMOTION', username, `Deleted promotion ${promoId}`);
  },
};
