import mongoose from 'mongoose';
import { db } from '../../../shared/config/db.js';
import { AppError } from '../../../shared/utils/appError.js';
import { Wishlist } from '../models/wishlist.model.js';
import {
  IWishlist,
  IWishlistItem,
  IEnrichedWishlistItem,
  IWishlistResponse,
} from '../interfaces/wishlist.interface.js';

const EXPIRATION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const wishlistService = {
  /**
   * Helper: Calculate refreshed 30-day expiration date
   */
  getRefreshedExpiration(): Date {
    return new Date(Date.now() + EXPIRATION_TTL_MS);
  },

  /**
   * Retrieve or initialize guest wishlist document
   */
  async findWishlistByGuestId(guestId: string): Promise<IWishlist | null> {
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Wishlist.findOne({ guest_id: guestId }).lean();
        if (doc) {
          return {
            id: String(doc._id),
            guest_id: doc.guest_id,
            items: (doc.items || []).map((i: any) => ({
              menu_item_id: String(i.menu_item_id),
              added_at: i.added_at,
            })),
            expires_at: doc.expires_at,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          };
        }
      } catch {
        // fallback
      }
    }

    const state = db.getState() as any;
    const wishlists: IWishlist[] = state.wishlists || [];
    return wishlists.find((w) => w.guest_id === guestId) || null;
  },

  /**
   * Retrieve full wishlist populated with current live menu details
   */
  async getWishlist(guestId: string): Promise<IWishlistResponse> {
    const wishlist = await this.findWishlistByGuestId(guestId);
    const expiresAt = wishlist?.expires_at || this.getRefreshedExpiration();

    if (!wishlist || !wishlist.items || wishlist.items.length === 0) {
      return {
        guestId,
        totalItems: 0,
        items: [],
        expiresAt,
      };
    }

    const allDishes = db.getState().dishes || [];
    const validItems: IEnrichedWishlistItem[] = [];
    const staleItemIds: string[] = [];

    for (const item of wishlist.items) {
      const dish = allDishes.find((d) => d.id === item.menu_item_id || d.slug === item.menu_item_id);
      if (dish) {
        validItems.push({
          menu_item_id: dish.id,
          name: dish.name,
          slug: dish.slug,
          description: dish.description,
          price: dish.price,
          image: dish.image,
          category: dish.category,
          available: dish.available,
          isVeg: dish.isVeg,
          added_at: item.added_at,
        });
      } else {
        // Dish was deleted or removed from menu - flag for automatic cleanup
        staleItemIds.push(item.menu_item_id);
      }
    }

    // Auto-clean stale menu item references from database asynchronously
    if (staleItemIds.length > 0) {
      this.cleanupStaleItems(guestId, staleItemIds).catch(() => {});
    }

    return {
      guestId,
      totalItems: validItems.length,
      items: validItems,
      expiresAt,
    };
  },

  /**
   * Add a menu item to the guest wishlist
   */
  async addItem(guestId: string, menuItemId: string): Promise<{ alreadyExists: boolean; message: string; item: IEnrichedWishlistItem }> {
    const trimmedId = (menuItemId || '').trim();
    if (!trimmedId) {
      throw new AppError('Valid menu item ID is required.', 400);
    }

    // Validate that the menu item exists in the current menu
    const allDishes = db.getState().dishes || [];
    const dish = allDishes.find((d) => d.id === trimmedId || d.slug === trimmedId);
    if (!dish) {
      throw new AppError('Food item not found on menu.', 404);
    }

    const newExpiresAt = this.getRefreshedExpiration();
    const existing = await this.findWishlistByGuestId(guestId);

    // Check for duplicate item reference
    const alreadySaved = existing?.items?.some((i) => i.menu_item_id === dish.id || i.menu_item_id === dish.slug);
    if (alreadySaved) {
      return {
        alreadyExists: true,
        message: 'Item already exists in your wishlist.',
        item: {
          menu_item_id: dish.id,
          name: dish.name,
          slug: dish.slug,
          description: dish.description,
          price: dish.price,
          image: dish.image,
          category: dish.category,
          available: dish.available,
          isVeg: dish.isVeg,
          added_at: existing?.items?.find((i) => i.menu_item_id === dish.id || i.menu_item_id === dish.slug)?.added_at || new Date(),
        },
      };
    }

    const newItem: IWishlistItem = {
      menu_item_id: dish.id,
      added_at: new Date().toISOString(),
    };

    // 1. Atomic Mongoose upsert with $addToSet
    if (mongoose.connection.readyState === 1) {
      try {
        await Wishlist.findOneAndUpdate(
          { guest_id: guestId },
          {
            $addToSet: { items: { menu_item_id: dish.id, added_at: new Date() } },
            $set: { expires_at: newExpiresAt },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (err: any) {
        console.warn('[WishlistService] Mongoose update error:', err?.message);
      }
    }

    // 2. Local State synchronization
    db.updateState((s: any) => {
      if (!s.wishlists) s.wishlists = [];
      let w = s.wishlists.find((item: any) => item.guest_id === guestId);
      if (!w) {
        w = {
          id: 'wsh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          guest_id: guestId,
          items: [newItem],
          expires_at: newExpiresAt.toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        s.wishlists.push(w);
      } else {
        if (!w.items.some((i: any) => i.menu_item_id === dish.id)) {
          w.items.push(newItem);
        }
        w.expires_at = newExpiresAt.toISOString();
        w.updatedAt = new Date().toISOString();
      }
    });

    return {
      alreadyExists: false,
      message: 'Item added to wishlist successfully.',
      item: {
        menu_item_id: dish.id,
        name: dish.name,
        slug: dish.slug,
        description: dish.description,
        price: dish.price,
        image: dish.image,
        category: dish.category,
        available: dish.available,
        isVeg: dish.isVeg,
        added_at: newItem.added_at,
      },
    };
  },

  /**
   * Remove a menu item from the guest wishlist
   */
  async removeItem(guestId: string, menuItemId: string): Promise<{ success: boolean; message: string }> {
    const trimmedId = (menuItemId || '').trim();
    if (!trimmedId) {
      throw new AppError('Menu item ID is required.', 400);
    }

    const wishlist = await this.findWishlistByGuestId(guestId);
    if (!wishlist || !wishlist.items || wishlist.items.length === 0) {
      throw new AppError('Item not found in your wishlist.', 404);
    }

    const itemExists = wishlist.items.some((i) => i.menu_item_id === trimmedId);
    if (!itemExists) {
      throw new AppError('Item not found in your wishlist.', 404);
    }

    const newExpiresAt = this.getRefreshedExpiration();

    // 1. Atomic Mongoose update with $pull
    if (mongoose.connection.readyState === 1) {
      try {
        await Wishlist.findOneAndUpdate(
          { guest_id: guestId },
          {
            $pull: { items: { menu_item_id: trimmedId } },
            $set: { expires_at: newExpiresAt },
          }
        );
      } catch (err: any) {
        console.warn('[WishlistService] Mongoose pull error:', err?.message);
      }
    }

    // 2. Local State synchronization
    db.updateState((s: any) => {
      if (s.wishlists) {
        const w = s.wishlists.find((item: any) => item.guest_id === guestId);
        if (w) {
          w.items = w.items.filter((i: any) => i.menu_item_id !== trimmedId);
          w.expires_at = newExpiresAt.toISOString();
          w.updatedAt = new Date().toISOString();
        }
      }
    });

    return {
      success: true,
      message: 'Item removed from wishlist successfully.',
    };
  },

  /**
   * Clear all items in the guest wishlist
   */
  async clearWishlist(guestId: string): Promise<{ success: boolean; message: string; totalItems: number }> {
    const newExpiresAt = this.getRefreshedExpiration();

    if (mongoose.connection.readyState === 1) {
      try {
        await Wishlist.findOneAndUpdate(
          { guest_id: guestId },
          {
            $set: { items: [], expires_at: newExpiresAt },
          }
        );
      } catch (err: any) {
        console.warn('[WishlistService] Mongoose clear error:', err?.message);
      }
    }

    db.updateState((s: any) => {
      if (s.wishlists) {
        const w = s.wishlists.find((item: any) => item.guest_id === guestId);
        if (w) {
          w.items = [];
          w.expires_at = newExpiresAt.toISOString();
          w.updatedAt = new Date().toISOString();
        }
      }
    });

    return {
      success: true,
      message: 'Wishlist cleared successfully.',
      totalItems: 0,
    };
  },

  /**
   * Check if a specific menu item is in the guest wishlist
   */
  async checkItemStatus(guestId: string, menuItemId: string): Promise<{ menuItemId: string; isWishlisted: boolean }> {
    const trimmedId = (menuItemId || '').trim();
    if (!trimmedId) {
      throw new AppError('Menu item ID is required.', 400);
    }

    const wishlist = await this.findWishlistByGuestId(guestId);
    const isWishlisted = Boolean(wishlist?.items?.some((i) => i.menu_item_id === trimmedId));

    return {
      menuItemId: trimmedId,
      isWishlisted,
    };
  },

  /**
   * Initialize guest session and return status
   */
  async initializeSession(guestId: string): Promise<{ guestId: string; sessionActive: boolean; expiresAt: string }> {
    const wishlist = await this.findWishlistByGuestId(guestId);
    const expiresAt = wishlist?.expires_at
      ? new Date(wishlist.expires_at).toISOString()
      : this.getRefreshedExpiration().toISOString();

    return {
      guestId,
      sessionActive: true,
      expiresAt,
    };
  },

  /**
   * Internal helper: Clean up deleted / stale menu item references
   */
  async cleanupStaleItems(guestId: string, staleIds: string[]): Promise<void> {
    if (!staleIds || staleIds.length === 0) return;

    if (mongoose.connection.readyState === 1) {
      try {
        await Wishlist.findOneAndUpdate(
          { guest_id: guestId },
          { $pull: { items: { menu_item_id: { $in: staleIds } } } }
        );
      } catch {
        // ignore
      }
    }

    db.updateState((s: any) => {
      if (s.wishlists) {
        const w = s.wishlists.find((item: any) => item.guest_id === guestId);
        if (w) {
          w.items = w.items.filter((i: any) => !staleIds.includes(i.menu_item_id));
        }
      }
    });
  },
};

export default wishlistService;
