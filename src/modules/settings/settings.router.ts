import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as settingsController from './settings.controller.js';

const router = Router();

// Public
router.get('/', settingsController.getPublicSettings);

// Admin
router.get('/admin', protect, settingsController.getAdminSettings);
router.put('/admin', protect, restrictTo('superadmin'), settingsController.updateSettings);

export default router;
