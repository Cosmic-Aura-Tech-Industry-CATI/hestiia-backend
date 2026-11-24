import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { cartService } from './cart.service.js';
import { sendSuccess } from '../../shared/responses/index.js';

export const getCart = catchAsync(async (req: Request, res: Response) => {
  const guestId = req.guestId || (req.headers['x-guest-id'] as string);
  const cart = await cartService.getCart(guestId, (req as any).user?.id);
  sendSuccess(res, { cart });
});

export const addItem = catchAsync(async (req: Request, res: Response) => {
  const guestId = req.guestId || (req.headers['x-guest-id'] as string);
  const cart = await cartService.addItem(guestId, req.body, (req as any).user?.id);
  sendSuccess(res, { cart }, 201, 'Dish added to dining tray.');
});

export const updateItem = catchAsync(async (req: Request, res: Response) => {
  const guestId = req.guestId || (req.headers['x-guest-id'] as string);
  const dishId = Array.isArray(req.params.dishId) ? req.params.dishId[0] : req.params.dishId;
  const cart = await cartService.updateItem(guestId, dishId, req.body);
  sendSuccess(res, { cart }, 200, 'Tray item updated.');
});

export const removeItem = catchAsync(async (req: Request, res: Response) => {
  const guestId = req.guestId || (req.headers['x-guest-id'] as string);
  const dishId = Array.isArray(req.params.dishId) ? req.params.dishId[0] : req.params.dishId;
  const cart = await cartService.removeItem(guestId, dishId);
  sendSuccess(res, { cart }, 200, 'Item removed from dining tray.');
});

export const clearCart = catchAsync(async (req: Request, res: Response) => {
  const guestId = req.guestId || (req.headers['x-guest-id'] as string);
  const cart = await cartService.clearCart(guestId);
  sendSuccess(res, { cart }, 200, 'Dining tray cleared.');
});

export const updateFulfillment = catchAsync(async (req: Request, res: Response) => {
  const guestId = req.guestId || (req.headers['x-guest-id'] as string);
  const cart = await cartService.updateFulfillment(guestId, req.body.fulfillmentType);
  sendSuccess(res, { cart }, 200, 'Fulfillment preference updated.');
});

export const applyCoupon = catchAsync(async (req: Request, res: Response) => {
  const guestId = req.guestId || (req.headers['x-guest-id'] as string);
  const result = await cartService.applyCoupon(guestId, req.body.couponCode);
  sendSuccess(res, result, 200, 'Promotional offer applied.');
});
