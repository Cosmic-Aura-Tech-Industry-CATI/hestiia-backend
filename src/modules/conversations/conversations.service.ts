import mongoose from 'mongoose';
import { Conversation, type IConversationDocument } from './conversation.model.js';
import { broadcast } from '../../sockets/socketServer.js';
import { jobQueue } from '../../jobs/jobQueue.js';
import { BadRequestError } from '../../shared/errors/index.js';

export interface ChatMessage {
  id: string;
  orderNumber: string;
  senderRole: 'customer' | 'admin' | 'system';
  senderName: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

export interface ConversationSummary {
  orderNumber: string;
  lastMessage: any;
  totalMessages: number;
  unreadCount: number;
  lastActivity?: Date | string;
}

const messagesStore: ChatMessage[] = [];

export const conversationsService = {
  /**
   * Retrieve all messages for a specific order in chronological order
   */
  async getMessagesByOrder(orderNumber: string): Promise<any[]> {
    const cleanOrderNumber = String(orderNumber || '').trim();
    if (!cleanOrderNumber) {
      throw new BadRequestError('Order number is required');
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const dbMsgs = await Conversation.find({ orderNumber: cleanOrderNumber })
          .sort({ createdAt: 1 })
          .lean();
        if (dbMsgs.length > 0) return dbMsgs;
      } catch (err: any) {
        console.warn(`[ConversationsService] Mongo find failed: ${err?.message}`);
      }
    }

    return messagesStore.filter((m) => m.orderNumber === cleanOrderNumber);
  },

  /**
   * Get all active conversation threads aggregated by orderNumber with unread counts
   * Uses high-performance MongoDB aggregation pipeline with in-memory fallback
   */
  async getAllConversations(): Promise<ConversationSummary[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const summaries = await Conversation.aggregate([
          { $sort: { createdAt: 1 } },
          {
            $group: {
              _id: '$orderNumber',
              lastMessageDoc: { $last: '$$ROOT' },
              totalMessages: { $sum: 1 },
              unreadCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$isRead', false] },
                        { $eq: ['$senderRole', 'customer'] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              lastActivity: { $max: '$createdAt' },
            },
          },
          { $sort: { lastActivity: -1 } },
        ]);

        if (summaries && summaries.length > 0) {
          return summaries.map((s: any) => ({
            orderNumber: s._id,
            lastMessage: s.lastMessageDoc
              ? {
                  id: s.lastMessageDoc._id ? String(s.lastMessageDoc._id) : s.lastMessageDoc.id,
                  orderNumber: s.lastMessageDoc.orderNumber,
                  senderRole: s.lastMessageDoc.senderRole,
                  senderName: s.lastMessageDoc.senderName,
                  text: s.lastMessageDoc.text,
                  isRead: s.lastMessageDoc.isRead,
                  createdAt: s.lastMessageDoc.createdAt,
                  timestamp: s.lastMessageDoc.createdAt
                    ? new Date(s.lastMessageDoc.createdAt).toISOString()
                    : undefined,
                }
              : null,
            totalMessages: s.totalMessages,
            unreadCount: s.unreadCount,
            lastActivity: s.lastActivity,
          }));
        }
      } catch (err: any) {
        console.warn(`[ConversationsService] Mongo aggregation failed: ${err?.message}`);
      }
    }

    // In-memory fallback
    const ordersWithChat = Array.from(new Set(messagesStore.map((m) => m.orderNumber)));
    return ordersWithChat.map((orderNumber) => {
      const orderMsgs = messagesStore.filter((m) => m.orderNumber === orderNumber);
      const lastMsg = orderMsgs[orderMsgs.length - 1];
      return {
        orderNumber,
        lastMessage: lastMsg || null,
        totalMessages: orderMsgs.length,
        unreadCount: orderMsgs.filter((m) => !m.isRead && m.senderRole === 'customer').length,
        lastActivity: lastMsg?.timestamp,
      };
    });
  },

  /**
   * Post a new message from a customer, staff, or system, persisting it and broadcasting live via WebSockets
   */
  async sendMessage(
    orderNumber: string,
    senderRole: 'customer' | 'admin' | 'system',
    senderName: string,
    text: string
  ): Promise<any> {
    const cleanOrderNumber = String(orderNumber || '').trim();
    const cleanText = String(text || '').trim();
    const cleanSenderName =
      String(senderName || '').trim() || (senderRole === 'admin' ? 'Staff' : 'Customer');

    if (!cleanOrderNumber) {
      throw new BadRequestError('Order number is required for messaging');
    }
    if (!cleanText) {
      throw new BadRequestError('Message text cannot be empty');
    }
    if (cleanText.length > 1000) {
      throw new BadRequestError('Message exceeds maximum limit of 1000 characters');
    }

    const isRead = false;
    let dbMsg: any = null;

    if (mongoose.connection.readyState === 1) {
      try {
        dbMsg = await Conversation.create({
          orderNumber: cleanOrderNumber,
          senderRole,
          senderName: cleanSenderName,
          text: cleanText,
          isRead,
        });
      } catch (err: any) {
        console.warn(`[ConversationsService] Mongo insert failed: ${err?.message}`);
      }
    }

    const newMsg: ChatMessage = {
      id: dbMsg?._id ? String(dbMsg._id) : 'msg_' + Date.now(),
      orderNumber: cleanOrderNumber,
      senderRole,
      senderName: cleanSenderName,
      text: cleanText,
      timestamp: new Date().toISOString(),
      isRead,
    };

    messagesStore.push(newMsg);

    // Broadcast live event to customer room and admin channel
    broadcast(`room:order:${cleanOrderNumber}`, 'chat:message', newMsg);
    broadcast('room:admin:chat', 'chat:message', newMsg);

    // Dispatch background notification queue alert for staff when customer messages
    if (senderRole === 'customer') {
      jobQueue.dispatch('ADMIN_CHAT_ALERT', {
        orderNumber: cleanOrderNumber,
        text: cleanText,
        senderName: cleanSenderName,
      });
    }

    return dbMsg || newMsg;
  },

  /**
   * Mark messages in an order thread as read by the opposing party
   */
  async markMessagesAsRead(
    orderNumber: string,
    readerRole: 'customer' | 'admin'
  ): Promise<{ modifiedCount: number; orderNumber: string; readerRole: string }> {
    const cleanOrderNumber = String(orderNumber || '').trim();
    if (!cleanOrderNumber) {
      throw new BadRequestError('Order number is required');
    }

    const targetSenderRole = readerRole === 'admin' ? 'customer' : 'admin';
    let modifiedCount = 0;

    if (mongoose.connection.readyState === 1) {
      try {
        const updateResult = await Conversation.updateMany(
          {
            orderNumber: cleanOrderNumber,
            senderRole: targetSenderRole,
            isRead: false,
          },
          { $set: { isRead: true } }
        );
        modifiedCount = updateResult.modifiedCount;
      } catch (err: any) {
        console.warn(`[ConversationsService] Mongo markRead failed: ${err?.message}`);
      }
    }

    // Synchronize in-memory fallback store
    for (const msg of messagesStore) {
      if (
        msg.orderNumber === cleanOrderNumber &&
        msg.senderRole === targetSenderRole &&
        !msg.isRead
      ) {
        msg.isRead = true;
        modifiedCount++;
      }
    }

    // Emit live read receipt via WebSockets
    const readReceiptPayload = {
      orderNumber: cleanOrderNumber,
      readerRole,
      readAt: new Date().toISOString(),
    };
    broadcast(`room:order:${cleanOrderNumber}`, 'chat:read', readReceiptPayload);
    broadcast('room:admin:chat', 'chat:read', readReceiptPayload);

    return { modifiedCount, orderNumber: cleanOrderNumber, readerRole };
  },

  /**
   * Get unread badge counts for management/admin dashboard navbar
   */
  async getUnreadAdminCount(): Promise<{ totalUnreadMessages: number; activeOrdersWithUnread: number }> {
    if (mongoose.connection.readyState === 1) {
      try {
        const [totalUnread, ordersWithUnread] = await Promise.all([
          Conversation.countDocuments({ senderRole: 'customer', isRead: false }),
          Conversation.distinct('orderNumber', { senderRole: 'customer', isRead: false }),
        ]);
        return {
          totalUnreadMessages: totalUnread,
          activeOrdersWithUnread: ordersWithUnread.length,
        };
      } catch (err: any) {
        console.warn(`[ConversationsService] Mongo unread count failed: ${err?.message}`);
      }
    }

    const unreadMsgs = messagesStore.filter((m) => m.senderRole === 'customer' && !m.isRead);
    const distinctOrders = new Set(unreadMsgs.map((m) => m.orderNumber));
    return {
      totalUnreadMessages: unreadMsgs.length,
      activeOrdersWithUnread: distinctOrders.size,
    };
  },
};

export default conversationsService;
