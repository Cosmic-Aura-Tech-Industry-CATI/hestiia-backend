import { db } from '../../shared/config/store.js';
import { broadcast } from '../../sockets/socketServer.js';
import { jobQueue } from '../../jobs/jobQueue.js';

export interface ChatMessage {
  id: string;
  orderNumber: string;
  senderRole: 'customer' | 'admin' | 'system';
  senderName: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

const messagesStore: ChatMessage[] = [
  {
    id: 'msg_1',
    orderNumber: 'HST-2026-1001',
    senderRole: 'customer',
    senderName: 'Aditya Srivastava',
    text: 'Please pack extra green chutney with Handi Paneer.',
    timestamp: '2026-10-24T19:35:00Z',
    isRead: true,
  },
  {
    id: 'msg_2',
    orderNumber: 'HST-2026-1001',
    senderRole: 'admin',
    senderName: 'Floor Manager',
    text: 'Done! Extra chutney and roasted papad packed.',
    timestamp: '2026-10-24T19:36:00Z',
    isRead: true,
  },
];

export const conversationsService = {
  async getMessagesByOrder(orderNumber: string) {
    return messagesStore.filter((m) => m.orderNumber === orderNumber);
  },
  async getAllConversations() {
    const ordersWithChat = Array.from(new Set(messagesStore.map((m) => m.orderNumber)));
    return ordersWithChat.map((orderNumber) => {
      const orderMsgs = messagesStore.filter((m) => m.orderNumber === orderNumber);
      return {
        orderNumber,
        lastMessage: orderMsgs[orderMsgs.length - 1],
        totalMessages: orderMsgs.length,
        unreadCount: orderMsgs.filter((m) => !m.isRead && m.senderRole === 'customer').length,
      };
    });
  },
  async sendMessage(orderNumber: string, senderRole: 'customer' | 'admin', senderName: string, text: string) {
    const newMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      orderNumber,
      senderRole,
      senderName,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      isRead: senderRole === 'admin',
    };
    messagesStore.push(newMsg);
    broadcast(`room:order:${orderNumber}`, 'chat:message', newMsg);
    broadcast('room:admin:chat', 'chat:message', newMsg);

    if (senderRole === 'customer') {
      jobQueue.dispatch('ADMIN_CHAT_ALERT', { orderNumber, text });
    }

    return newMsg;
  },
};

export default conversationsService;
