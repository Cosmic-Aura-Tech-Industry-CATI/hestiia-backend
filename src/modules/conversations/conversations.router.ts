import { Router } from 'express';
import { protect, restrictTo } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './conversations.controller.js';

const router = Router();

// 1. Staff / Admin Navbar Badges - Unread Messages Count
router.get(
  '/unread-count',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getUnreadCount
);

// 2. Staff / Admin - List All Active Conversations with Summaries
router.get(
  '/',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.getAllConversations
);

// 3. Admin / Staff Reply to Specific Order Thread
router.post(
  '/:orderNumber/reply',
  protect,
  restrictTo('SUPERADMIN', 'MANAGER', 'STAFF'),
  controller.sendAdminReply
);

// 4. Mark Messages as Read (Customer or Staff)
router.patch('/:orderNumber/read', controller.markAsRead);

// 5. Get Messages by Order Number (Customer or Staff)
router.get('/:orderNumber', controller.getMessagesByOrder);

// 6. Post Customer Message to Order Chat
router.post('/:orderNumber', controller.sendMessage);

export default router;
export const conversationsRouter = router;
