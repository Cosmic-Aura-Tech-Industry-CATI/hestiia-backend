import { AppError } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';
import { logAudit } from '@/lib/audit';
import { IPromotion, PromotionModel } from '@/models/Promotion.model';
import { cleanDoc, cleanDocs } from '@/models/_schema';

export const promotionsService = {
  async getPublicPromotions() {
    await connectDB();
    const docs = await PromotionModel.find({ isActive: true })
      .sort({ displayOrder: 1 })
      .lean();
    return cleanDocs<IPromotion>(docs);
  },

  async getAdminPromotions() {
    await connectDB();
    const docs = await PromotionModel.find({}).sort({ displayOrder: 1 }).lean();
    return cleanDocs<IPromotion>(docs);
  },

  async createPromotion(data: any, username = 'admin') {
    const {
      title,
      subtitle,
      price,
      originalPrice,
      serves,
      badge,
      items,
      image,
      startDate,
      endDate,
      isActive = true,
    } = data;

    if (!title || price === undefined) {
      throw new AppError('Offer title and price are required.', 400);
    }

    await connectDB();
    const total = await PromotionModel.countDocuments();
    const newPromo: IPromotion = {
      id: `promo-${Date.now()}`,
      title: String(title).trim(),
      subtitle: String(subtitle || '').trim(),
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : Number(price),
      serves: String(serves || '2 Guests').trim(),
      badge: String(badge || 'Special Offer').trim(),
      items: Array.isArray(items)
        ? items
        : String(items || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
      image: image || '/images/dishes/handi-paneer.jpg',
      startDate,
      endDate,
      isActive: Boolean(isActive),
      displayOrder: total + 1,
    };

    await PromotionModel.create(newPromo);
    await logAudit(
      'CREATE_PROMOTION',
      username,
      `Created dining offer: ${newPromo.title}`
    );

    return newPromo;
  },

  async updatePromotion(promoId: string, data: any, username = 'admin') {
    await connectDB();
    const {
      title,
      subtitle,
      price,
      originalPrice,
      serves,
      badge,
      items,
      image,
      startDate,
      endDate,
      isActive,
      displayOrder,
    } = data;

    const updates: Record<string, any> = {};
    if (title) updates.title = String(title).trim();
    if (subtitle !== undefined) updates.subtitle = String(subtitle).trim();
    if (price !== undefined) updates.price = Number(price);
    if (originalPrice !== undefined) updates.originalPrice = Number(originalPrice);
    if (serves !== undefined) updates.serves = String(serves).trim();
    if (badge !== undefined) updates.badge = String(badge).trim();
    if (items !== undefined) {
      updates.items = Array.isArray(items)
        ? items
        : String(items)
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    if (image) updates.image = image;
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (displayOrder !== undefined) updates.displayOrder = Number(displayOrder);

    const updated = await PromotionModel.findOneAndUpdate(
      { id: promoId },
      { $set: updates },
      { new: true }
    ).lean();

    if (!updated) {
      throw new AppError('Promotion offer not found.', 404);
    }

    const clean = cleanDoc<IPromotion>(updated);
    await logAudit('UPDATE_PROMOTION', username, `Updated promotion: ${clean.title}`);
    return clean;
  },

  async deletePromotion(promoId: string, username = 'admin') {
    await connectDB();
    await PromotionModel.deleteOne({ id: promoId });
    await logAudit('DELETE_PROMOTION', username, `Deleted promotion ${promoId}`);
  },
};
