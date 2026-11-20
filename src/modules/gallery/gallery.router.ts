import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as galleryController from './gallery.controller.js';

const router = Router();

// Public
router.get('/', galleryController.getPublicGallery);

// Admin
router.get('/admin/all', protect, galleryController.getAdminGallery);
router.post('/admin', protect, restrictTo('superadmin', 'manager'), galleryController.addPhoto);
router.put('/admin/:id', protect, restrictTo('superadmin', 'manager'), galleryController.updatePhoto);
router.delete('/admin/:id', protect, restrictTo('superadmin', 'manager'), galleryController.deletePhoto);

export default router;
