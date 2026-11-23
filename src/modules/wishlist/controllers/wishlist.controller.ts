import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/utils/index.js';
import { sendSuccess } from '../../../shared/responses/index.js';
import { AppError } from '../../../shared/utils/appError.js';
import { wishlistService } from '../services/wishlist.service.js';

export const wishlistController = {
  /**
   * GET /api/v1/wishlist/session
   * Initialize or verify guest session
   */
  getSession: catchAsync(async (req: Request, res: Response) => {
    const guestId = req.guestId;
    if (!guestId) {
      throw new AppError('Guest identity not initialized.', 401);
    }
    const session = await wishlistService.initializeSession(guestId);
    sendSuccess(res, session, 200, 'Guest session active');
  }),

  /**
   * GET /api/v1/wishlist
   * Retrieve all saved items in guest wishlist
   */
  getWishlist: catchAsync(async (req: Request, res: Response) => {
    const guestId = req.guestId;
    if (!guestId) {
      throw new AppError('Guest identity not initialized.', 401);
    }
    const result = await wishlistService.getWishlist(guestId);
    sendSuccess(res, result);
  }),

  /**
   * POST /api/v1/wishlist/items/:menuItemId
   * Add a menu item to the wishlist
   */
  addItem: catchAsync(async (req: Request, res: Response) => {
    const guestId = req.guestId;
    if (!guestId) {
      throw new AppError('Guest identity not initialized.', 401);
    }
    const menuItemId = Array.isArray(req.params.menuItemId) ? req.params.menuItemId[0] : req.params.menuItemId;
    const result = await wishlistService.addItem(guestId, menuItemId);
    const statusCode = result.alreadyExists ? 200 : 201;
    sendSuccess(res, result, statusCode, result.message);
  }),

  /**
   * DELETE /api/v1/wishlist/items/:menuItemId
   * Remove a menu item from the wishlist
   */
  removeItem: catchAsync(async (req: Request, res: Response) => {
    const guestId = req.guestId;
    if (!guestId) {
      throw new AppError('Guest identity not initialized.', 401);
    }
    const menuItemId = Array.isArray(req.params.menuItemId) ? req.params.menuItemId[0] : req.params.menuItemId;
    const result = await wishlistService.removeItem(guestId, menuItemId);
    sendSuccess(res, result, 200, result.message);
  }),

  /**
   * DELETE /api/v1/wishlist
   * Clear entire wishlist for current guest
   */
  clearWishlist: catchAsync(async (req: Request, res: Response) => {
    const guestId = req.guestId;
    if (!guestId) {
      throw new AppError('Guest identity not initialized.', 401);
    }
    const result = await wishlistService.clearWishlist(guestId);
    sendSuccess(res, result, 200, result.message);
  }),

  /**
   * GET /api/v1/wishlist/items/:menuItemId/status
   * Check if an item is currently wishlisted
   */
  checkStatus: catchAsync(async (req: Request, res: Response) => {
    const guestId = req.guestId;
    if (!guestId) {
      throw new AppError('Guest identity not initialized.', 401);
    }
    const menuItemId = Array.isArray(req.params.menuItemId) ? req.params.menuItemId[0] : req.params.menuItemId;
    const result = await wishlistService.checkItemStatus(guestId, menuItemId);
    sendSuccess(res, result);
  }),
};

export default wishlistController;
