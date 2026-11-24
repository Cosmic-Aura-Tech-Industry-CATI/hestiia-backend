import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/utils/index.js';
import { offersService } from '../services/offers.service.js';

export const offersController = {
  // ---------------------------------------------------------------------------
  // ADMIN SERVICES
  // ---------------------------------------------------------------------------

  /**
   * Admin Service 1: Create Offer (POST /api/admin/offers)
   */
  createOffer: catchAsync(async (req: Request, res: Response) => {
    const actor = (req as any).user?.username || (req as any).user?.name || 'admin';
    const offer = await offersService.createOffer(req.body, actor);
    return res.status(201).json({
      success: true,
      message: 'Offer created successfully',
      data: offer,
    });
  }),

  /**
   * Admin Service 2: Get All Offers (GET /api/admin/offers)
   */
  getAllAdminOffers: catchAsync(async (req: Request, res: Response) => {
    const result = await offersService.getAllAdminOffers(req.query as any);
    return res.status(200).json({
      success: true,
      message: 'Offers retrieved successfully',
      data: result,
    });
  }),

  /**
   * Admin Service 8: Get Dashboard Summary (GET /api/admin/offers/summary)
   * Note: Mounted BEFORE /:id route to avoid route parameter collision
   */
  getOffersSummary: catchAsync(async (_req: Request, res: Response) => {
    const summary = await offersService.getOffersSummary();
    return res.status(200).json({
      success: true,
      message: 'Offers dashboard summary retrieved successfully',
      data: summary,
    });
  }),

  /**
   * Admin Service 3: Get Offer By ID (GET /api/admin/offers/:id)
   */
  getOfferById: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const offer = await offersService.getOfferById(id);
    return res.status(200).json({
      success: true,
      message: 'Offer details retrieved successfully',
      data: offer,
    });
  }),

  /**
   * Admin Service 4: Update Offer (PUT /api/admin/offers/:id)
   */
  updateOffer: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const actor = (req as any).user?.username || (req as any).user?.name || 'admin';
    const offer = await offersService.updateOffer(id, req.body, actor);
    return res.status(200).json({
      success: true,
      message: 'Offer updated successfully',
      data: offer,
    });
  }),

  /**
   * Admin Service 5: Activate / Deactivate Offer (PATCH /api/admin/offers/:id/status)
   */
  updateOfferStatus: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const actor = (req as any).user?.username || (req as any).user?.name || 'admin';
    const offer = await offersService.updateOfferStatus(id, req.body.isActive, actor);
    return res.status(200).json({
      success: true,
      message: `Offer ${offer.isActive ? 'activated' : 'deactivated'} successfully`,
      data: offer,
    });
  }),

  /**
   * Admin Service 6: Archive Offer (DELETE /api/admin/offers/:id)
   */
  archiveOffer: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const actor = (req as any).user?.username || (req as any).user?.name || 'admin';
    const result = await offersService.archiveOffer(id, actor);
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  }),

  /**
   * Admin Service 7: Get Offer Analytics (GET /api/admin/offers/:id/analytics)
   */
  getOfferAnalytics: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const analytics = await offersService.getOfferAnalytics(id);
    return res.status(200).json({
      success: true,
      message: 'Offer analytics retrieved successfully',
      data: analytics,
    });
  }),

  // ---------------------------------------------------------------------------
  // CUSTOMER SERVICES
  // ---------------------------------------------------------------------------

  /**
   * Customer Service 1: Get Current Valid Offers (GET /api/customer/offers)
   */
  getCurrentOffers: catchAsync(async (_req: Request, res: Response) => {
    const offers = await offersService.getCurrentOffers();
    return res.status(200).json({
      success: true,
      message: 'Active promotional offers retrieved',
      data: offers,
    });
  }),

  /**
   * Customer Service 2: Get Home Page Offers (GET /api/customer/offers/home)
   */
  getHomeOffers: catchAsync(async (_req: Request, res: Response) => {
    const offers = await offersService.getHomeOffers();
    return res.status(200).json({
      success: true,
      message: 'Home page promotional offers retrieved',
      data: offers,
    });
  }),

  /**
   * Customer Service 3: Get Menu Page Offers (GET /api/customer/offers/menu)
   */
  getMenuOffers: catchAsync(async (_req: Request, res: Response) => {
    const offers = await offersService.getMenuOffers();
    return res.status(200).json({
      success: true,
      message: 'Menu page promotional offers retrieved',
      data: offers,
    });
  }),

  /**
   * Customer Service 4: Get Customer Offer Details (GET /api/customer/offers/:id)
   */
  getCustomerOfferById: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const offer = await offersService.getCustomerOfferById(id);
    return res.status(200).json({
      success: true,
      message: 'Offer details retrieved successfully',
      data: offer,
    });
  }),
};

export default offersController;
