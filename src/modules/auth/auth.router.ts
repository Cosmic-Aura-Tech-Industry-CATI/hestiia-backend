import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middlewares/auth.middleware.js';
import * as authController from './auth.controller.js';

const router = Router();

// ==========================================
// 1. PUBLIC AUTHENTICATION & RECOVERY ROUTES
// ==========================================
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Dedicated Superadmin Creation Endpoints
router.post('/create-superadmin', authController.createSuperAdmin);
router.post('/superadmin', authController.createSuperAdmin);

// ==========================================
// 2. AUTHENTICATED USER ROUTES
// ==========================================
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.getMe);

// ==========================================
// 3. USER MANAGEMENT ROUTES (SUPERADMIN ONLY)
// ==========================================
router.post('/users', requireAuth, requireRole('SUPERADMIN'), authController.createUser);
router.get('/users', requireAuth, requireRole('SUPERADMIN'), authController.getUsers);
router.get('/users/:id', requireAuth, requireRole('SUPERADMIN'), authController.getUserById);
router.patch('/users/:id', requireAuth, requireRole('SUPERADMIN'), authController.updateUser);
router.patch('/users/:id/role', requireAuth, requireRole('SUPERADMIN'), authController.updateUserRole);
router.patch('/users/:id/status', requireAuth, requireRole('SUPERADMIN'), authController.updateUserStatus);
router.delete('/users/:id', requireAuth, requireRole('SUPERADMIN'), authController.deleteUser);

export default router;
