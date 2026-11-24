import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/index.js';
import { sendSuccess, sendCreated } from '../../shared/responses/index.js';
import { contactService } from './contact.service.js';

export const getCustomerContact = catchAsync(async (_req: Request, res: Response) => {
  const contactInfo = await contactService.getCustomerContact();
  return res.status(200).json({
    success: true,
    message: 'Contact information retrieved successfully',
    data: contactInfo,
  });
});

export const getAdminSettings = catchAsync(async (_req: Request, res: Response) => {
  const settings = await contactService.getAdminSettings();
  return res.status(200).json({
    success: true,
    message: 'Contact settings retrieved successfully',
    data: settings,
  });
});

export const updateAdminSettings = catchAsync(async (req: Request, res: Response) => {
  const actor = (req as any).user?.username || (req as any).user?.name || 'admin';
  const updated = await contactService.updateSettings(req.body, actor);
  return res.status(200).json({
    success: true,
    message: 'Contact settings updated successfully',
    data: updated,
  });
});

export const submitInquiry = catchAsync(async (req: Request, res: Response) => {
  const meta = {
    ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '',
    userAgent: req.headers['user-agent'] || '',
  };
  const inquiry = await contactService.createInquiry(req.body, meta);
  sendCreated(
    res,
    { inquiry },
    'Thank you for reaching out! Your message has been received and our team will get back to you shortly.'
  );
});

export const getInquiries = catchAsync(async (req: Request, res: Response) => {
  const result = await contactService.getInquiries(req.query);
  sendSuccess(res, result);
});

export const getInquiryById = catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const inquiry = await contactService.getInquiryById(id);
  sendSuccess(res, { inquiry });
});

export const updateInquiry = catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const inquiry = await contactService.updateInquiryStatus(id, req.body, (req as any).user);
  sendSuccess(res, { inquiry }, 200, 'Contact inquiry updated successfully');
});

export const deleteInquiry = catchAsync(async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await contactService.deleteInquiry(id);
  sendSuccess(res, null, 200, 'Contact inquiry deleted successfully');
});

export const getContactStats = catchAsync(async (_req: Request, res: Response) => {
  const stats = await contactService.getContactStats();
  sendSuccess(res, { stats });
});

export const getStatus = catchAsync(async (_req: Request, res: Response) => {
  const status = await contactService.getStatus();
  sendSuccess(res, status);
});

export const contactController = {
  getCustomerContact,
  getAdminSettings,
  updateAdminSettings,
  submitInquiry,
  getInquiries,
  getInquiryById,
  updateInquiry,
  deleteInquiry,
  getContactStats,
  getStatus,
};

export default contactController;
