import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as auditController from './audit.controller.js';

const router = Router();

// Protect all audit routes
router.use(protect);

// 1. Audit Statistics & Security Breakdown
router.get('/stats', restrictTo('SUPERADMIN', 'MANAGER'), auditController.getAuditStats);

// 2. Query Audit Trail Logs
router.get('/', restrictTo('SUPERADMIN', 'MANAGER'), auditController.getAuditLogs);

// 3. Purge Historical Audit Logs (Admin Maintenance)
router.delete('/purge', restrictTo('ADMIN', 'SUPERADMIN', 'MANAGER'), auditController.clearOldLogs);

export default router;
