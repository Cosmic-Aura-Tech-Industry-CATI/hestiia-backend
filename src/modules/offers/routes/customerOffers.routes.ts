import { Router } from 'express';
import { offersController } from '../controllers/offers.controller.js';

const router = Router();

// Public Customer Offer Discovery Routes (No admin authentication required)
// Customer Service 1: Get Current Valid Offers (GET /api/customer/offers)
router.get('/', offersController.getCurrentOffers);

// Customer Service 2: Get Home Page Offers (GET /api/customer/offers/home)
router.get('/home', offersController.getHomeOffers);

// Customer Service 3: Get Menu Page Offers (GET /api/customer/offers/menu)
router.get('/menu', offersController.getMenuOffers);

// Customer Service 4: Get Offer Details (GET /api/customer/offers/:id)
router.get('/:id', offersController.getCustomerOfferById);

export default router;
