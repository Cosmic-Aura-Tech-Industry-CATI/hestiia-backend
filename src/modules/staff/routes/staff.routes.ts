import { Router } from 'express';
import { protect, restrictTo } from '../../../middleware/auth.middleware.js';
import { staffController } from '../controllers/staff.controller.js';

const router = Router();

// Private Module: Strictly requires authenticated Admin (superadmin or manager)
router.use(protect);
router.use(restrictTo('superadmin', 'manager'));

// Service 1: Create Staff (POST /api/admin/staff)
router.post('/', staffController.createStaff);

// Service 2: Get All Staff (GET /api/admin/staff)
router.get('/', staffController.getAllStaff);

// Service 3: Get Staff by ID (GET /api/admin/staff/:id)
router.get('/:id', staffController.getStaffById);

// Service 4: Update Staff (PUT /api/admin/staff/:id & PATCH /api/admin/staff/:id)
router.put('/:id', staffController.updateStaff);
router.patch('/:id', staffController.updateStaff);

// Service 5: Soft Delete Staff (DELETE /api/admin/staff/:id)
router.delete('/:id', staffController.deleteStaff);

export default router;
