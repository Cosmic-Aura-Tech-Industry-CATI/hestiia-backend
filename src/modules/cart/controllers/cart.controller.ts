import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/utils/index.js';
import { cartService } from '../services/cart.service.js';

export const cartController = {
  /**
   * Customer Service 5: Apply Offer to Cart
   * POST /api/customer/cart/apply-offer
   */
  applyOffer: catchAsync(async (req: Request, res: Response) => {
    const { cartId, offerId } = req.body;
    const guestId = (req as any).guestId || req.cookies?.hestiia_guest_id || (req.headers['x-guest-id'] as string);
    const customerId = (req as any).user?.id;

    const updatedCart = await cartService.applyOffer({
      cartId,
      offerId,
      guestId,
      customerId,
    });

    return res.status(200).json({
      success: true,
      message: 'Offer applied successfully',
      data: updatedCart,
    });
  }),

  /**
   * Customer Service 6: Remove Applied Offer from Cart
   * DELETE /api/customer/cart/remove-offer
   */
  removeOffer: catchAsync(async (req: Request, res: Response) => {
    const cartId = (req.body && req.body.cartId) || (req.query && req.query.cartId) as string;
    const guestId = (req as any).guestId || req.cookies?.hestiia_guest_id || (req.headers['x-guest-id'] as string);
    const customerId = (req as any).user?.id;

    const updatedCart = await cartService.removeOffer({
      cartId,
      guestId,
      customerId,
    });

    return res.status(200).json({
      success: true,
      message: 'Offer removed successfully',
      data: updatedCart,
    });
  }),

  /**
   * Get Cart
   * GET /api/customer/cart
   */
  getCart: catchAsync(async (req: Request, res: Response) => {
    const cartId = (req.query.cartId as string) || undefined;
    const guestId = (req as any).guestId || req.cookies?.hestiia_guest_id || (req.headers['x-guest-id'] as string);
    const customerId = (req as any).user?.id;

    const cart = await cartService.getOrCreateCart(cartId, guestId, customerId);
    return res.status(200).json({
      success: true,
      data: cart,
    });
  }),

  /**
   * Add Item to Cart
   * POST /api/customer/cart/items
   */
  addItem: catchAsync(async (req: Request, res: Response) => {
    const { cartId, dishId, name, price, quantity, image } = req.body;
    const guestId = (req as any).guestId || req.cookies?.hestiia_guest_id || (req.headers['x-guest-id'] as string);
    const customerId = (req as any).user?.id;

    const cart = await cartService.addItem({
      cartId,
      guestId,
      customerId,
      dishId,
      name,
      price,
      quantity,
      image,
    });

    return res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: cart,
    });
  }),
};

export default cartController;
