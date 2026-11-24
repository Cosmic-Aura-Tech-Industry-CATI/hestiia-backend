import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as settingsController from './settings.controller.js';

const router = Router();

// Public
router.get('/', settingsController.getPublicSettings);

// Admin
router.get('/admin', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), settingsController.getAdminSettings);
router.put('/admin', protect, restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), settingsController.updateSettings);

export default router;
