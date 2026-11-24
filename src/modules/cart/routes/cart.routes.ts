import { Router } from 'express';
import { cartController } from '../controllers/cart.controller.js';

const router = Router();

// Customer Cart & Offer Application Endpoints
router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);

// Service 5: Apply Offer (POST /api/customer/cart/apply-offer)
router.post('/apply-offer', cartController.applyOffer);

// Service 6: Remove Offer (DELETE /api/customer/cart/remove-offer)
router.delete('/remove-offer', cartController.removeOffer);

export default router;
