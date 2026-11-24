import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middlewares/auth.middleware.js';
import * as authController from './auth.controller.js';

const router = Router();

// ==========================================
// 1. PUBLIC AUTHENTICATION & RECOVERY ROUTES
// ==========================================
router.post('/login', authController.login);
router.post('/admin/login', authController.adminLogin);
router.post('/staff/login', authController.staffLogin);
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
// 3. USER MANAGEMENT ROUTES (ADMIN ONLY)
// ==========================================
router.post('/users', requireAuth, requireRole('ADMIN', 'SUPERADMIN', 'MANAGER'), authController.createUser);
router.get('/users', requireAuth, requireRole('ADMIN', 'SUPERADMIN', 'MANAGER'), authController.getUsers);
router.get('/users/:id', requireAuth, requireRole('ADMIN', 'SUPERADMIN', 'MANAGER'), authController.getUserById);
router.patch('/users/:id', requireAuth, requireRole('ADMIN', 'SUPERADMIN', 'MANAGER'), authController.updateUser);
router.patch('/users/:id/role', requireAuth, requireRole('ADMIN', 'SUPERADMIN', 'MANAGER'), authController.updateUserRole);
router.patch('/users/:id/status', requireAuth, requireRole('ADMIN', 'SUPERADMIN', 'MANAGER'), authController.updateUserStatus);
router.delete('/users/:id', requireAuth, requireRole('ADMIN', 'SUPERADMIN', 'MANAGER'), authController.deleteUser);

export default router;
