import { Router } from 'express';
import { protect } from '../../shared/middlewares/auth.middleware.js';
import * as dashboardController from './dashboard.controller.js';

const router = Router();

router.use(protect);
router.get('/overview', dashboardController.getOverview);

export default router;
