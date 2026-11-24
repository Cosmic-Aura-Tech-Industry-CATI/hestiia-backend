import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import { upload } from '../../shared/middlewares/upload.middleware.js';
import * as uploadController from './upload.controller.js';

const router = Router();

// Public / operational status check
router.get('/status', uploadController.getStatus);

// Protected routes (Staff / Managers / Superadmins)
router.use(protect);

// Single file upload (accepts field 'image' or 'file')
router.post('/', upload.single('image'), uploadController.uploadImage);
router.post('/single', upload.single('image'), uploadController.uploadImage);

// Multi-file upload (up to 10 images)
router.post('/multiple', upload.array('images', 10), uploadController.uploadMultiple);

// Storage analytics
router.get('/stats', restrictTo('SUPERADMIN', 'MANAGER'), uploadController.getStorageStats);

// Delete uploaded asset
router.delete('/:filename', restrictTo('SUPERADMIN', 'MANAGER'), uploadController.deleteUploadedFile);

export default router;
export const uploadRouter = router;
