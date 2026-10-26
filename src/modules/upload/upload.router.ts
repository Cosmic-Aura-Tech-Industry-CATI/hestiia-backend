import { Router } from 'express';
import { protect } from '../../shared/middlewares/auth.middleware.js';
import { upload } from '../../shared/middlewares/upload.middleware.js';
import * as uploadController from './upload.controller.js';

const router = Router();

router.use(protect);
router.post('/', upload.single('image'), uploadController.uploadImage);

export default router;
