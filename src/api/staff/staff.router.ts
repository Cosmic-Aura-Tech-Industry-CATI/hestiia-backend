import { Router } from 'express';
import { staffRouter as staffOperationsRouter } from '../../modules/staff/index.js';
import * as authController from '../../modules/auth/auth.controller.js';
import { requireAuth } from '../../shared/middlewares/auth.middleware.js';

const router = Router();

// ==========================================
// 1. PUBLIC STAFF AUTHENTICATION (STAFF LOGIN)
// ==========================================
router.post('/auth/login', authController.staffLogin);
router.post('/login', authController.staffLogin);
router.post('/auth/refresh', authController.refresh);
router.post('/refresh', authController.refresh);

// ==========================================
// 2. AUTHENTICATED STAFF SESSION
// ==========================================
router.post('/auth/logout', requireAuth, authController.logout);
router.post('/logout', requireAuth, authController.logout);
router.get('/auth/me', requireAuth, authController.getMe);
router.get('/me', requireAuth, authController.getMe);

// ==========================================
// 3. STAFF OPERATIONS (KDS, Shifts, Dining Floor)
// ==========================================
router.use('/', staffOperationsRouter);

export default router;
export { router as staffRouter };
