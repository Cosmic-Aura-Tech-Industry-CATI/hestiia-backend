import { Router } from 'express';
import { protect, restrictTo } from '../../../middleware/auth.middleware.js';
import { upload } from '../../../shared/middlewares/upload.middleware.js';
import { galleryController } from '../controllers/gallery.controller.js';
import { mediaCategoryController } from '../controllers/mediaCategory.controller.js';
import { mediaModerationController } from '../controllers/mediaModeration.controller.js';

export const adminGalleryRouter = Router();

// Protect all admin gallery routes
adminGalleryRouter.use(protect);
adminGalleryRouter.use(restrictTo('SUPERADMIN', 'MANAGER', 'superadmin', 'manager'));

// ==========================================
// 1. OFFICIAL GALLERY MANAGEMENT
// ==========================================
adminGalleryRouter.post('/photos', upload.any(), galleryController.uploadOfficialPhoto);
adminGalleryRouter.get('/photos', galleryController.getAdminPhotos);
adminGalleryRouter.get('/photos/:id', galleryController.getAdminPhotoById);
adminGalleryRouter.put('/photos/:id', galleryController.updatePhoto);
adminGalleryRouter.delete('/photos/:id', galleryController.deletePhoto);
adminGalleryRouter.patch('/photos/:id/status', galleryController.updatePhotoStatus);

// ==========================================
// 2. GALLERY SECTIONS MANAGEMENT
// ==========================================
adminGalleryRouter.post('/sections', mediaCategoryController.createSection);
adminGalleryRouter.get('/sections', mediaCategoryController.getAdminSections);
adminGalleryRouter.put('/sections/:id', mediaCategoryController.updateSection);
adminGalleryRouter.delete('/sections/:id', mediaCategoryController.deleteSection);

// ==========================================
// 3. CUSTOMER SUBMISSIONS & MODERATION
// ==========================================
adminGalleryRouter.get('/customer-uploads', mediaModerationController.getAdminCustomerUploads);
adminGalleryRouter.get('/customer-uploads/:id', mediaModerationController.getCustomerUploadById);
adminGalleryRouter.patch('/customer-uploads/:id/moderate', mediaModerationController.moderateUpload);
adminGalleryRouter.delete('/customer-uploads/:id', mediaModerationController.deleteCustomerUpload);

// ==========================================
// 4. BACKWARD COMPATIBILITY ALIASES
// ==========================================
adminGalleryRouter.get('/all', galleryController.getAdminPhotos);
adminGalleryRouter.post('/', upload.any(), galleryController.uploadOfficialPhoto);
adminGalleryRouter.put('/:id', galleryController.updatePhoto);
adminGalleryRouter.delete('/:id', galleryController.deletePhoto);

export default adminGalleryRouter;
