import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/index.js';
import { contactService } from './contact.service.js';

export const contactController = {
  /**
   * API 1: Customer - Get Contact Information (Public)
   * GET /api/customer/contact
   */
  getCustomerContact: catchAsync(async (_req: Request, res: Response) => {
    const contactInfo = await contactService.getCustomerContact();
    return res.status(200).json({
      success: true,
      message: 'Contact information retrieved successfully',
      data: contactInfo,
    });
  }),

  /**
   * API 2: Admin - Get Contact Settings (Admin only)
   * GET /api/admin/contact
   */
  getAdminSettings: catchAsync(async (_req: Request, res: Response) => {
    const settings = await contactService.getAdminSettings();
    return res.status(200).json({
      success: true,
      message: 'Contact settings retrieved successfully',
      data: settings,
    });
  }),

  /**
   * API 3: Admin - Update Contact Settings (Admin only)
   * PUT /api/admin/contact
   */
  updateAdminSettings: catchAsync(async (req: Request, res: Response) => {
    const actor = (req as any).user?.username || (req as any).user?.name || 'admin';
    const updated = await contactService.updateSettings(req.body, actor);
    return res.status(200).json({
      success: true,
      message: 'Contact settings updated successfully',
      data: updated,
    });
  }),
};

export default contactController;
