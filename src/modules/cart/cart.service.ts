import mongoose from 'mongoose';
import { Cart, type ICartDocument } from './cart.model.js';
import { MenuItem } from '../menu/menu.model.js';
import { Promotion } from '../promotions/promotion.model.js';
import { offersService } from '../offers/offers.service.js';
import { restaurantService } from '../restaurant/restaurant.service.js';
import { AppError } from '../../shared/utils/appError.js';
import type { ICartItem } from './cart.interface.js';

export const cartService = {
  async getStatus() {
    return { module: 'cart', status: 'operational', timestamp: new Date().toISOString() };
  },

  /**
   * Internal helper to recalculate financial totals in integer paise
   */
  async recalculateCartTotals(cart: ICartDocument): Promise<ICartDocument> {
    const settings = await restaurantService.getInfo();
    const taxRatePercent = settings?.taxRatePercent || 5;
    const baseDeliveryFee = Number(settings?.deliveryFee ?? 40);

    let calculatedSubtotalPaise = 0;

    for (const item of cart.items) {
      const priceInPaise = item.priceInPaise || Math.round(item.price * 100);
      const itemTotalPaise = priceInPaise * item.quantity;
      item.priceInPaise = priceInPaise;
      item.total = itemTotalPaise / 100;
      item.totalInPaise = itemTotalPaise;
      calculatedSubtotalPaise += itemTotalPaise;
    }

    cart.subtotalInPaise = calculatedSubtotalPaise;
    cart.subtotal = calculatedSubtotalPaise / 100;

    // Calculate Tax in integer paise
    const taxInPaise = Math.round((calculatedSubtotalPaise * taxRatePercent) / 100);
    cart.taxInPaise = taxInPaise;
    cart.taxAmount = taxInPaise / 100;

    // Delivery charge applies only for home delivery
    const deliveryInPaise =
      cart.fulfillmentType === 'delivery' && calculatedSubtotalPaise > 0
        ? Math.round(baseDeliveryFee * 100)
        : 0;
    cart.deliveryInPaise = deliveryInPaise;
    cart.deliveryCharge = deliveryInPaise / 100;

    // Discount
    const discountInPaise = cart.discountInPaise || 0;
    cart.discountAmount = discountInPaise / 100;

    const grandTotalPaise = Math.max(0, calculatedSubtotalPaise + taxInPaise + deliveryInPaise - discountInPaise);
    cart.grandTotalInPaise = grandTotalPaise;
    cart.grandTotal = grandTotalPaise / 100;

    // Reset 30-day expiration window on every user modification
    cart.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return cart;
  },

  /**
   * 1. Retrieve or Initialize Guest Cart
   */
  async getCart(guestId: string, userId?: string): Promise<any> {
    if (!guestId) {
      throw new AppError('Guest session identifier is required.', 400);
    }

    let cart = await Cart.findOne({ guestId });
    if (!cart) {
      cart = await Cart.create({
        guestId,
        userId,
        items: [],
        fulfillmentType: 'delivery',
      });
    } else if (userId && !cart.userId) {
      cart.userId = userId;
    }

    // Live validation of dishes against active menu items (high-performance batch query)
    if (cart.items.length > 0) {
      let modified = false;
      const rawDishIds = cart.items.map((i) => i.dishId).filter(Boolean);
      const validIds = rawDishIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      const slugs = rawDishIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));

      let dishes: any[] = [];
      if (rawDishIds.length > 0) {
        try {
          dishes = await MenuItem.find({
            $or: [
              ...(validIds.length > 0 ? [{ _id: { $in: validIds } }] : []),
              ...(slugs.length > 0 ? [{ slug: { $in: slugs } }] : []),
            ],
          })
            .select('name slug price image available')
            .lean();
        } catch { }
      }

      const dishMap = new Map<string, any>();
      for (const d of dishes) {
        if (d._id) dishMap.set(d._id.toString(), d);
        if (d.slug) dishMap.set(d.slug.toLowerCase(), d);
      }

      for (const item of cart.items) {
        const dish = dishMap.get(item.dishId) || dishMap.get(item.dishId.toLowerCase());
        if (dish) {
          // Sync dish details in case admin updated price or image
          if (dish.price !== item.price) {
            item.price = dish.price;
            item.priceInPaise = Math.round(dish.price * 100);
            modified = true;
          }
          if (dish.name !== item.name) {
            item.name = dish.name;
            modified = true;
          }
          if (dish.image && dish.image !== item.image) {
            item.image = dish.image;
            modified = true;
          }
        }
      }

      await this.recalculateCartTotals(cart);
      await cart.save();
    }

    return cart.toJSON();
  },

  /**
   * 2. Add Dish Item to Cart
   */
  async addItem(
    guestId: string,
    payload: { dishId: string; quantity?: number; notes?: string },
    userId?: string
  ): Promise<any> {
    const { dishId, quantity = 1, notes } = payload;

    if (!dishId || String(dishId).trim() === '') {
      throw new AppError('Dish identifier is required to add item to cart.', 400);
    }

    const addQty = Math.max(1, parseInt(String(quantity), 10) || 1);

    // 1. Verify dish in active MenuItem collection
    let dish: any = null;
    if (mongoose.Types.ObjectId.isValid(dishId)) {
      dish = await MenuItem.findById(dishId).lean();
    }
    if (!dish) {
      dish = await MenuItem.findOne({
        $or: [
          { slug: dishId },
          { name: { $regex: new RegExp(`^${dishId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } },
        ],
      }).lean();
    }

    if (!dish) {
      throw new AppError(`Dish with identifier '${dishId}' not found in active menu.`, 404);
    }
    if (!dish.available) {
      throw new AppError(`'${dish.name}' is currently sold out and unavailable.`, 400);
    }

    let cart = await Cart.findOne({ guestId });
    if (!cart) {
      cart = new Cart({
        guestId,
        userId,
        items: [],
        fulfillmentType: 'delivery',
      });
    }

    const existingIndex = cart.items.findIndex((item) => item.dishId === (dish._id ? String(dish._id) : dish.id));

    const price = dish.price;
    const priceInPaise = Math.round(price * 100);

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += addQty;
      if (notes !== undefined) {
        cart.items[existingIndex].notes = notes.trim();
      }
    } else {
      const newItem: ICartItem = {
        dishId: dish._id ? String(dish._id) : dish.id,
        name: dish.name,
        price,
        priceInPaise,
        quantity: addQty,
        total: (priceInPaise * addQty) / 100,
        totalInPaise: priceInPaise * addQty,
        image: dish.image || '/uploads/menu/default-dish.webp',
        notes: notes ? notes.trim() : '',
        addedAt: new Date(),
      };
      cart.items.push(newItem);
    }

    await this.recalculateCartTotals(cart);
    await cart.save();

    return cart.toJSON();
  },

  /**
   * 3. Update Existing Item Quantity or Cooking Instructions
   */
  async updateItem(
    guestId: string,
    dishId: string,
    updates: { quantity?: number; notes?: string }
  ): Promise<any> {
    const cart = await Cart.findOne({ guestId });
    if (!cart) {
      throw new AppError('Cart not found.', 404);
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.dishId === dishId || item.dishId.toLowerCase() === dishId.toLowerCase()
    );

    if (itemIndex === -1) {
      throw new AppError('Item not found in current cart.', 404);
    }

    if (updates.quantity !== undefined) {
      const newQty = parseInt(String(updates.quantity), 10);
      if (newQty <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = newQty;
      }
    }

    if (updates.notes !== undefined && cart.items[itemIndex]) {
      cart.items[itemIndex].notes = updates.notes.trim();
    }

    await this.recalculateCartTotals(cart);
    await cart.save();

    return cart.toJSON();
  },

  /**
   * 4. Remove Single Dish from Cart
   */
  async removeItem(guestId: string, dishId: string): Promise<any> {
    const cart = await Cart.findOne({ guestId });
    if (!cart) {
      throw new AppError('Cart not found.', 404);
    }

    cart.items = cart.items.filter(
      (item) => item.dishId !== dishId && item.dishId.toLowerCase() !== dishId.toLowerCase()
    );

    await this.recalculateCartTotals(cart);
    await cart.save();

    return cart.toJSON();
  },

  /**
   * 5. Clear All Items in Cart
   */
  async clearCart(guestId: string): Promise<any> {
    const cart = await Cart.findOne({ guestId });
    if (!cart) {
      return { success: true, items: [], grandTotal: 0 };
    }

    cart.items = [];
    cart.appliedCoupon = '';
    cart.discountAmount = 0;
    cart.discountInPaise = 0;

    await this.recalculateCartTotals(cart);
    await cart.save();

    return cart.toJSON();
  },

  /**
   * 6. Switch Fulfillment Type (Delivery vs. Dine-In vs. Pickup)
   */
  async updateFulfillment(
    guestId: string,
    fulfillmentType: 'delivery' | 'dine-in' | 'pickup'
  ): Promise<any> {
    if (!['delivery', 'dine-in', 'pickup'].includes(fulfillmentType)) {
      throw new AppError("Invalid fulfillment type. Must be 'delivery', 'dine-in', or 'pickup'.", 400);
    }

    const cart = await Cart.findOne({ guestId });
    if (!cart) {
      throw new AppError('Cart not found.', 404);
    }

    cart.fulfillmentType = fulfillmentType;
    await this.recalculateCartTotals(cart);
    await cart.save();

    return cart.toJSON();
  },

  /**
   * 7. Apply Promotional Coupon / Bundle
   */
  async applyCoupon(guestId: string, couponCode: string): Promise<any> {
    if (!couponCode || couponCode.trim() === '') {
      throw new AppError('Coupon code is required.', 400);
    }

    const cleanCode = couponCode.trim().toUpperCase();
    const cart = await Cart.findOne({ guestId });
    if (!cart) {
      throw new AppError('Cart not found.', 404);
    }

    if (cart.items.length === 0) {
      throw new AppError('Your tray is empty. Add dishes before applying promotional offers.', 400);
    }

    let discountPaise = 0;
    try {
      const offerResult = await offersService.validateAndCalculateDiscount(
        cleanCode,
        cart.subtotalInPaise,
        cart.fulfillmentType
      );
      discountPaise = offerResult.discountPaise;
    } catch {
      // Fallback check promotions in MongoDB Atlas
      const promo = await Promotion.findOne({
        $or: [
          { badge: { $regex: new RegExp(`^${cleanCode}$`, 'i') } },
          { title: { $regex: new RegExp(`^${cleanCode}$`, 'i') } },
        ],
        isActive: true,
      }).lean();

      if (promo && promo.originalPrice && promo.originalPrice > promo.price) {
        discountPaise = Math.round((promo.originalPrice - promo.price) * 100);
      } else if (cleanCode === 'WELCOME10') {
        discountPaise = Math.round((cart.subtotalInPaise * 10) / 100);
      } else {
        throw new AppError(`Coupon code '${cleanCode}' is invalid or expired.`, 400);
      }
    }

    cart.appliedCoupon = cleanCode;
    cart.discountInPaise = discountPaise;
    cart.discountAmount = discountPaise / 100;

    await this.recalculateCartTotals(cart);
    await cart.save();

    return {
      success: true,
      appliedCoupon: cleanCode,
      discountAmount: cart.discountAmount,
      cart: cart.toJSON(),
    };
  },
};

export default cartService;
