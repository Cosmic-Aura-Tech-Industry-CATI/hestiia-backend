import { Router } from 'express';
import { guestIdentityMiddleware } from '../wishlist/middleware/guestIdentity.middleware.js';
import * as cartController from './cart.controller.js';
import modularCartRouter from './routes/cart.routes.js';

export const cartRouter = Router();

// 1. Resolve or establish persistent guest session
cartRouter.use(guestIdentityMiddleware);

// 2. Cart Operations
cartRouter.get('/', cartController.getCart);
cartRouter.post('/items', cartController.addItem);
cartRouter.patch('/items/:dishId', cartController.updateItem);
cartRouter.delete('/items/:dishId', cartController.removeItem);
cartRouter.delete('/', cartController.clearCart);
cartRouter.patch('/fulfillment', cartController.updateFulfillment);
cartRouter.post('/coupon', cartController.applyCoupon);

// 3. Modular Cart Offer Endpoints (/apply-offer, /remove-offer)
cartRouter.use('/', modularCartRouter);

export default cartRouter;
