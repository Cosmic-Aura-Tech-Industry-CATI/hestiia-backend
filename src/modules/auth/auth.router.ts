import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as authController from './auth.controller.js';

const router = Router();

// Public Authentication & Recovery routes
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.use(protect);
router.get('/me', authController.getMe);
router.post('/logout', authController.logout);
router.post('/change-password', authController.changePassword);

// Superadmin Only
router.get('/users', restrictTo('superadmin'), authController.getAllUsers);
router.post('/users', restrictTo('superadmin'), authController.createUser);

export default router;
