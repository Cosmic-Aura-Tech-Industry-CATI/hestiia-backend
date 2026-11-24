import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { sendSuccess } from '../../shared/responses/index.js';
import { conversationsService } from './conversations.service.js';

/**
 * Get all active conversations with unread counter & last message preview (Admin / Staff)
 */
export const getAllConversations = catchAsync(async (_req: Request, res: Response) => {
  const conversations = await conversationsService.getAllConversations();
  sendSuccess(res, {
    count: conversations.length,
    conversations,
  });
});

/**
 * Get full chronological chat history for a specific order
 */
export const getMessagesByOrder = catchAsync(async (req: Request, res: Response) => {
  const orderNumber = Array.isArray(req.params.orderNumber)
    ? req.params.orderNumber[0]
    : req.params.orderNumber;

  const messages = await conversationsService.getMessagesByOrder(orderNumber);

  // Auto-mark as read if requested via query parameter
  if (req.query.markRead === 'true') {
    const user = (req as any).user;
    const readerRole = user ? 'admin' : 'customer';
    await conversationsService.markMessagesAsRead(orderNumber, readerRole);
  }

  sendSuccess(res, {
    orderNumber,
    count: messages.length,
    messages,
  });
});

/**
 * Post a customer message to the live order chat
 */
export const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const orderNumber = Array.isArray(req.params.orderNumber)
    ? req.params.orderNumber[0]
    : req.params.orderNumber;
  const user = (req as any).user;
  const senderRole = req.body.senderRole || (user ? 'admin' : 'customer');
  const senderName =
    req.body.senderName || user?.name || (senderRole === 'admin' ? 'Staff' : 'Customer');
  const text = req.body.text;

  const message = await conversationsService.sendMessage(
    orderNumber,
    senderRole,
    senderName,
    text
  );
  sendSuccess(res, { message }, 201, 'Message sent successfully');
});

/**
 * Send an official admin/staff reply to an order thread
 */
export const sendAdminReply = catchAsync(async (req: Request, res: Response) => {
  const orderNumber = Array.isArray(req.params.orderNumber)
    ? req.params.orderNumber[0]
    : req.params.orderNumber;
  const user = (req as any).user;
  const senderName = req.body.senderName || user?.name || 'Staff';
  const text = req.body.text;

  const message = await conversationsService.sendMessage(
    orderNumber,
    'admin',
    senderName,
    text
  );
  sendSuccess(res, { message }, 201, 'Admin reply sent successfully');
});

/**
 * Mark messages in an order chat as read
 */
export const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const orderNumber = Array.isArray(req.params.orderNumber)
    ? req.params.orderNumber[0]
    : req.params.orderNumber;
  const user = (req as any).user;
  const readerRole = req.body.readerRole || (user ? 'admin' : 'customer');

  const result = await conversationsService.markMessagesAsRead(orderNumber, readerRole);
  sendSuccess(res, result, 200, 'Messages marked as read');
});

/**
 * Get global unread messages count for staff notification badges
 */
export const getUnreadCount = catchAsync(async (_req: Request, res: Response) => {
  const result = await conversationsService.getUnreadAdminCount();
  sendSuccess(res, result);
});
