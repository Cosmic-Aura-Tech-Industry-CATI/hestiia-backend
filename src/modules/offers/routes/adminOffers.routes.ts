import { Router } from 'express';
import { protect, restrictTo } from '../../../middleware/auth.middleware.js';
import { offersController } from '../controllers/offers.controller.js';

const router = Router();

// Private: Strictly requires Admin authentication and superadmin/manager role
router.use(protect);
router.use(restrictTo('superadmin', 'manager'));

// Service 1: Create Offer (POST /api/admin/offers)
router.post('/', offersController.createOffer);

// Service 2: Get All Offers (GET /api/admin/offers)
router.get('/', offersController.getAllAdminOffers);

// Service 8: Get Dashboard Summary (GET /api/admin/offers/summary)
// (Must precede /:id parameter route)
router.get('/summary', offersController.getOffersSummary);

// Service 3: Get Offer By ID (GET /api/admin/offers/:id)
router.get('/:id', offersController.getOfferById);

// Service 4: Update Offer (PUT /api/admin/offers/:id)
router.put('/:id', offersController.updateOffer);

// Service 5: Activate / Deactivate Offer (PATCH /api/admin/offers/:id/status)
router.patch('/:id/status', offersController.updateOfferStatus);

// Service 6: Archive Offer (DELETE /api/admin/offers/:id)
router.delete('/:id', offersController.archiveOffer);

// Service 7: Get Offer Analytics (GET /api/admin/offers/:id/analytics)
router.get('/:id/analytics', offersController.getOfferAnalytics);

export default router;
