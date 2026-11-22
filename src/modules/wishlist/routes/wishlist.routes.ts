import { Router, Request, Response, NextFunction } from 'express';
import { guestIdentityMiddleware } from '../middleware/guestIdentity.middleware.js';
import { wishlistController } from '../controllers/wishlist.controller.js';
import { AppError } from '../../../shared/utils/appError.js';

export const wishlistRouter = Router();

// Apply guest identity resolution to all wishlist endpoints
wishlistRouter.use(guestIdentityMiddleware);

// 1. Session Initialization
wishlistRouter.get('/session', wishlistController.getSession);

// 2. Specific Item Status & Operations
wishlistRouter.get('/items/:menuItemId/status', wishlistController.checkStatus);
wishlistRouter.post('/items/:menuItemId', wishlistController.addItem);
wishlistRouter.delete('/items/:menuItemId', wishlistController.removeItem);

// Reject unsupported HTTP methods on /items/:menuItemId
wishlistRouter.all('/items/:menuItemId', (req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`HTTP method ${req.method} is not allowed on ${req.baseUrl}${req.path}. Use POST or DELETE.`, 405));
});

// 3. Collection Operations
wishlistRouter.get('/', wishlistController.getWishlist);
wishlistRouter.delete('/', wishlistController.clearWishlist);

// Reject unsupported HTTP methods on collection root /
wishlistRouter.all('/', (req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`HTTP method ${req.method} is not allowed on ${req.baseUrl}. Use GET or DELETE.`, 405));
});

export default wishlistRouter;
