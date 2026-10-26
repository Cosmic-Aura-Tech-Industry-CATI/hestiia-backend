import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as authController from './auth.controller.js';

const router = Router();

// Public
router.post('/login', authController.login);

// Protected
router.use(protect);
router.get('/me', authController.getMe);
router.post('/logout', authController.logout);
router.post('/change-password', authController.changePassword);

// Superadmin Only
router.get('/users', restrictTo('superadmin'), authController.getAllUsers);
router.post('/users', restrictTo('superadmin'), authController.createUser);

export default router;
