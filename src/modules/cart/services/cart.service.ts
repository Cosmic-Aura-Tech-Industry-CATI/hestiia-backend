import mongoose from 'mongoose';
import { db } from '../../../shared/config/db.js';
import { AppError } from '../../../shared/utils/appError.js';
import { Cart } from '../models/cart.model.js';
import { ICart, ICartItem, IAppliedOffer } from '../interfaces/cart.interface.js';
import { offersService } from '../../offers/services/offers.service.js';
import { discountCalculationService } from '../../offers/services/discountCalculation.service.js';
import { validateObjectId } from '../../offers/validators/offer.validator.js';

export const cartService = {
  /**
   * Helper: Retrieve or initialize cart for customer or guest
   */
  async getOrCreateCart(cartId?: string, guestId?: string, customerId?: string): Promise<ICart> {
    const cleanGuestId = guestId?.trim();
    const cleanCustomerId = customerId?.trim();

    // 1. Try finding by cartId if provided
    if (cartId && (mongoose.Types.ObjectId.isValid(cartId) || cartId.startsWith('cart_'))) {
      if (mongoose.connection.readyState === 1) {
        try {
          const doc = await Cart.findOne({
            $or: [{ _id: cartId }, { cartId: cartId }],
          }).lean();
          if (doc) return this.formatCartDoc(doc);
        } catch {}
      }
      const state = db.getState() as any;
      const found = (state.carts || []).find((c: any) => c._id === cartId || c.cartId === cartId);
      if (found) return found;
    }

    // 2. Try finding by guestId or customerId
    if (cleanCustomerId || cleanGuestId) {
      const query: any = {};
      if (cleanCustomerId) query.customerId = cleanCustomerId;
      else if (cleanGuestId) query.guestId = cleanGuestId;

      if (mongoose.connection.readyState === 1) {
        try {
          const doc = await Cart.findOne(query).sort({ updatedAt: -1 }).lean();
          if (doc) return this.formatCartDoc(doc);
        } catch {}
      }

      const state = db.getState() as any;
      const found = (state.carts || []).find((c: any) =>
        cleanCustomerId ? c.customerId === cleanCustomerId : c.guestId === cleanGuestId
      );
      if (found) return found;
    }

    // 3. Create fresh cart
    const newId = new mongoose.Types.ObjectId().toHexString();
    const newCart: ICart = {
      _id: newId,
      cartId: newId,
      guestId: cleanGuestId || `gst_${newId}`,
      customerId: cleanCustomerId,
      items: [],
      subtotal: 0,
      discountAmount: 0,
      appliedOffer: null,
      taxAmount: 0,
      deliveryFee: 0,
      payableAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await Cart.create({
          _id: new mongoose.Types.ObjectId(newId),
          cartId: newId,
          guestId: newCart.guestId,
          customerId: newCart.customerId,
          items: [],
          subtotal: 0,
          discountAmount: 0,
          appliedOffer: null,
          taxAmount: 0,
          deliveryFee: 0,
          payableAmount: 0,
        });
      } catch (err: any) {
        console.warn('[CartService] MongoDB cart creation fallback:', err?.message);
      }
    }

    db.updateState((s: any) => {
      if (!s.carts) s.carts = [];
      s.carts.push({ ...newCart });
    });

    return newCart;
  },

  /**
   * Add item to cart and recalculate totals
   */
  async addItem(params: {
    cartId?: string;
    guestId?: string;
    customerId?: string;
    dishId: string;
    name: string;
    price: number;
    quantity?: number;
    image?: string;
  }): Promise<ICart> {
    const { cartId, guestId, customerId, dishId, name, price, quantity = 1, image } = params;
    if (!dishId || !name || price === undefined) {
      throw new AppError('dishId, name, and price are required to add an item to cart.', 400);
    }
    const qty = Math.max(1, parseInt(String(quantity), 10) || 1);
    const itemPrice = Math.max(0, Number(price) || 0);

    const cart = await this.getOrCreateCart(cartId, guestId, customerId);

    const existingItemIdx = cart.items.findIndex((i) => i.dishId === dishId);
    if (existingItemIdx !== -1) {
      cart.items[existingItemIdx].quantity += qty;
      cart.items[existingItemIdx].total = cart.items[existingItemIdx].quantity * cart.items[existingItemIdx].price;
    } else {
      cart.items.push({
        dishId,
        name: name.trim(),
        price: itemPrice,
        quantity: qty,
        total: itemPrice * qty,
        image: image || '/uploads/menu/default-dish.webp',
      });
    }

    return this.recalculateAndSave(cart);
  },

  /**
   * Customer Service 5: Apply Offer to Cart
   */
  async applyOffer(params: {
    cartId: string;
    offerId: string;
    guestId?: string;
    customerId?: string;
  }): Promise<ICart> {
    const { cartId, offerId, guestId, customerId } = params;

    if (!cartId || typeof cartId !== 'string') {
      throw new AppError('Cart ID is required.', 400);
    }
    if (!offerId || typeof offerId !== 'string') {
      throw new AppError('Offer ID is required.', 400);
    }

    // 1. Retrieve cart
    const cart = await this.getOrCreateCart(cartId, guestId, customerId);

    // Verify cart ownership if customer or guest credentials passed
    if (customerId && cart.customerId && cart.customerId !== customerId) {
      throw new AppError('Unauthorized: You cannot apply an offer to another customer\'s cart.', 403);
    }
    if (guestId && cart.guestId && cart.guestId !== guestId && !customerId) {
      throw new AppError('Unauthorized: You cannot apply an offer to another session\'s cart.', 403);
    }

    // Verify cart is not empty
    if (!cart.items || cart.items.length === 0 || cart.subtotal <= 0) {
      throw new AppError('Cannot apply offer to an empty cart.', 400);
    }

    // 2. Retrieve offer
    const cleanOfferId = validateObjectId(offerId, 'offer ID');
    const offer = await offersService.getOfferById(cleanOfferId);

    // 3. Verify offer status and availability
    const availability = discountCalculationService.isOfferAvailable(offer);
    if (!availability.available) {
      throw new AppError(`Cannot apply offer: ${availability.reason}`, 400);
    }

    // 4. Calculate discount on backend (Never trust frontend provided calculation)
    const calculation = discountCalculationService.calculateDiscount(offer, cart.subtotal);

    // 5. Apply offer snapshot to cart
    cart.appliedOffer = {
      offerId: offer._id,
      title: offer.title,
      discountType: calculation.discountType,
      discountValue: calculation.discountValue,
      discountAmount: calculation.discountAmount,
    };
    cart.discountAmount = calculation.discountAmount;

    return this.recalculateAndSave(cart);
  },

  /**
   * Customer Service 6: Remove Applied Offer from Cart
   */
  async removeOffer(params: {
    cartId: string;
    guestId?: string;
    customerId?: string;
  }): Promise<ICart> {
    const { cartId, guestId, customerId } = params;

    if (!cartId || typeof cartId !== 'string') {
      throw new AppError('Cart ID is required.', 400);
    }

    const cart = await this.getOrCreateCart(cartId, guestId, customerId);

    // Verify ownership
    if (customerId && cart.customerId && cart.customerId !== customerId) {
      throw new AppError('Unauthorized: You cannot modify another customer\'s cart.', 403);
    }
    if (guestId && cart.guestId && cart.guestId !== guestId && !customerId) {
      throw new AppError('Unauthorized: You cannot modify another session\'s cart.', 403);
    }

    // Reset applied offer
    cart.appliedOffer = null;
    cart.discountAmount = 0;

    return this.recalculateAndSave(cart);
  },

  /**
   * Helper: Recalculate totals, validate active offer, and persist
   */
  async recalculateAndSave(cart: ICart): Promise<ICart> {
    // 1. Recalculate subtotal from trusted items
    cart.subtotal = cart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    cart.subtotal = Math.round(cart.subtotal * 100) / 100;

    // 2. Re-validate applied offer if one exists
    if (cart.appliedOffer && cart.appliedOffer.offerId) {
      try {
        const offer = await offersService.getOfferById(cart.appliedOffer.offerId);
        const check = discountCalculationService.isOfferAvailable(offer);

        if (!check.available || cart.subtotal < offer.minOrderValue) {
          // Offer no longer satisfies conditions (e.g. subtotal dropped below min requirement)
          cart.appliedOffer = null;
          cart.discountAmount = 0;
        } else {
          // Re-compute discount against updated subtotal
          const calc = discountCalculationService.calculateDiscount(offer, cart.subtotal);
          cart.appliedOffer.discountAmount = calc.discountAmount;
          cart.discountAmount = calc.discountAmount;
        }
      } catch {
        cart.appliedOffer = null;
        cart.discountAmount = 0;
      }
    } else {
      cart.discountAmount = 0;
    }

    // 3. Taxes & Delivery
    const settings = db.getState().settings;
    const taxRatePercent = settings?.taxRatePercent ?? 5; // 5% GST
    const baseAfterDiscount = Math.max(0, cart.subtotal - cart.discountAmount);
    cart.taxAmount = Math.round((baseAfterDiscount * taxRatePercent) / 100 * 100) / 100;
    cart.deliveryFee = cart.subtotal >= (settings?.minOrderValue || 300) ? 0 : (settings?.deliveryFee || 50);

    // 4. Final payable amount
    cart.payableAmount = Math.max(0, Math.round((baseAfterDiscount + cart.taxAmount + cart.deliveryFee) * 100) / 100);
    cart.updatedAt = new Date().toISOString();

    // Persist to MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        await Cart.findByIdAndUpdate(
          cart._id,
          {
            $set: {
              items: cart.items,
              subtotal: cart.subtotal,
              discountAmount: cart.discountAmount,
              appliedOffer: cart.appliedOffer,
              taxAmount: cart.taxAmount,
              deliveryFee: cart.deliveryFee,
              payableAmount: cart.payableAmount,
              updatedAt: new Date(),
            },
          },
          { new: true }
        );
      } catch (err: any) {
        console.warn('[CartService] MongoDB cart update fallback:', err?.message);
      }
    }

    // Persist to local store
    db.updateState((s: any) => {
      if (!s.carts) s.carts = [];
      const idx = s.carts.findIndex((c: any) => c._id === cart._id);
      if (idx !== -1) {
        s.carts[idx] = { ...cart };
      } else {
        s.carts.push({ ...cart });
      }
    });

    return cart;
  },

  formatCartDoc(doc: any): ICart {
    return {
      _id: doc._id.toString(),
      cartId: doc.cartId || doc._id.toString(),
      guestId: doc.guestId,
      customerId: doc.customerId,
      items: (doc.items || []).map((i: any) => ({
        dishId: i.dishId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        total: i.total,
        image: i.image,
      })),
      subtotal: doc.subtotal || 0,
      discountAmount: doc.discountAmount || 0,
      appliedOffer: doc.appliedOffer ? {
        offerId: doc.appliedOffer.offerId,
        title: doc.appliedOffer.title,
        discountType: doc.appliedOffer.discountType,
        discountValue: doc.appliedOffer.discountValue,
        discountAmount: doc.appliedOffer.discountAmount,
      } : null,
      taxAmount: doc.taxAmount || 0,
      deliveryFee: doc.deliveryFee || 0,
      payableAmount: doc.payableAmount || 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  },
};

export default cartService;
