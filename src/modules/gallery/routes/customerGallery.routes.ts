import { Router } from 'express';
import { guestIdentityMiddleware } from '../../wishlist/middleware/guestIdentity.middleware.js';
import { upload } from '../../../shared/middlewares/upload.middleware.js';
import { galleryController } from '../controllers/gallery.controller.js';
import { mediaCategoryController } from '../controllers/mediaCategory.controller.js';
import { customerUploadController } from '../controllers/customerUpload.controller.js';

export const customerGalleryRouter = Router();

// ==========================================
// 1. PUBLIC RESTAURANT GALLERY
// ==========================================
customerGalleryRouter.get('/sections', mediaCategoryController.getPublicSections);
customerGalleryRouter.get('/photos', galleryController.getPublicPhotos);
customerGalleryRouter.get('/photos/:id', galleryController.getPublicPhotoById);

// Root alias: GET /api/v1/gallery -> list public photos
customerGalleryRouter.get('/', galleryController.getPublicPhotos);

// ==========================================
// 2. GUEST CUSTOMER UPLOAD SYSTEM
// ==========================================
customerGalleryRouter.use(guestIdentityMiddleware);

// Upload customer photo (multipart/form-data with field name 'photo' or 'image')
customerGalleryRouter.post('/uploads', upload.any(), customerUploadController.submitPhoto);

// View and manage guest's own uploads
customerGalleryRouter.get('/my-uploads', customerUploadController.getMyUploads);
customerGalleryRouter.delete('/my-uploads/:id', customerUploadController.deleteMyUpload);

export default customerGalleryRouter;
