import { Router } from 'express';
import { protect } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './notifications.controller.js';

const router = Router();

router.use(protect);

router.get('/', controller.getNotifications);
router.post('/', controller.createNotification);
router.patch('/read-all', controller.markAllAsRead);
router.patch('/:id/read', controller.markAsRead);
router.get('/status', controller.getStatus);

export default router;
export const notificationsRouter = router;
