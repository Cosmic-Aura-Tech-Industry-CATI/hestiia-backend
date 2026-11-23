import mongoose from 'mongoose';
import { Notification } from './notification.model.js';
import { db } from '../../shared/config/store.js';
import { emailService } from '../../infrastructure/email/emailService.js';
import { smsService } from '../../infrastructure/sms/smsService.js';
import { broadcast } from '../../sockets/socketServer.js';
import { AppError } from '../../shared/utils/appError.js';
import type {
  INotificationItem,
  CreateNotificationDTO,
  NotificationQuery,
} from './notifications.interface.js';

let inMemoryNotifications: INotificationItem[] = [];

export const notificationsService = {
  /**
   * Dispatches alerts when a customer places an order
   */
  async notifyOrderCreated(order: any) {
    try {
      await emailService.sendAdminOrderAlert(order);
    } catch {}

    try {
      if (order.customerPhone) {
        await smsService.sendOrderSMS(order.customerPhone, `Your Hestiia order #${order.orderNumber} is confirmed!`);
      }
    } catch {}

    broadcast('room:kds:kitchen', 'order:new', order);
    broadcast('room:admin:overview', 'order:new', order);

    // Persist in-app notification for admin
    await this.createNotification({
      recipientType: 'admin',
      title: `New Order #${order.orderNumber}`,
      message: `Order #${order.orderNumber} received for ₹${order.grandTotal}. Fulfillment: ${order.fulfillmentType}.`,
      channel: 'in_app',
      metadata: { orderId: order.id || order._id, orderNumber: order.orderNumber },
    });
  },

  /**
   * Dispatches alerts when a table reservation is booked
   */
  async notifyBookingCreated(booking: any) {
    try {
      await emailService.sendBookingConfirmation(booking);
    } catch {}

    broadcast('room:admin:bookings', 'booking:new', booking);

    // Persist in-app notification for front desk
    await this.createNotification({
      recipientType: 'staff',
      title: `Table Booking #${booking.bookingRef || 'NEW'}`,
      message: `Table reserved for ${booking.customerName} on ${booking.date} at ${booking.time} (${booking.guests} guests).`,
      channel: 'in_app',
      metadata: { bookingId: booking.id || booking._id, bookingRef: booking.bookingRef },
    });
  },

  /**
   * Store and broadcast a new in-app notification
   */
  async createNotification(dto: CreateNotificationDTO): Promise<INotificationItem> {
    const item: INotificationItem = {
      recipientType: dto.recipientType || 'admin',
      recipientId: dto.recipientId,
      title: dto.title.trim(),
      message: dto.message.trim(),
      channel: dto.channel || 'in_app',
      isRead: false,
      metadata: dto.metadata || {},
    };

    let created: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await Notification.create(item);
        created = doc.toJSON();
      } catch {}
    }

    if (!created) {
      const id = 'notif_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      created = { ...item, id, createdAt: new Date(), updatedAt: new Date() };
      inMemoryNotifications.unshift(created);
    }

    // Live broadcast via WebSockets to appropriate room
    const room = dto.recipientType === 'customer' ? `user:${dto.recipientId}` : 'room:admin:overview';
    broadcast(room, 'notification:new', created);

    return created;
  },

  /**
   * Query notifications with filtering & pagination
   */
  async getNotifications(query: NotificationQuery = {}) {
    const { recipientId, recipientType, isRead, limit = 50, skip = 0 } = query;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (recipientId) filter.recipientId = recipientId;
        if (recipientType) filter.recipientType = recipientType;
        if (isRead !== undefined) filter.isRead = String(isRead) === 'true';

        const [notifications, total, unreadCount] = await Promise.all([
          Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip(Number(skip))
            .limit(Number(limit))
            .lean(),
          Notification.countDocuments(filter),
          Notification.countDocuments({ ...filter, isRead: false }),
        ]);

        return {
          notifications: notifications.map((n: any) => ({ ...n, id: n._id ? n._id.toString() : n.id })),
          total,
          unreadCount,
        };
      } catch {}
    }

    // In-memory fallback
    const filtered = inMemoryNotifications.filter((n) => {
      if (recipientId && n.recipientId !== recipientId) return false;
      if (recipientType && n.recipientType !== recipientType) return false;
      if (isRead !== undefined && n.isRead !== (String(isRead) === 'true')) return false;
      return true;
    });

    const unreadCount = filtered.filter((n) => !n.isRead).length;

    return {
      notifications: filtered.slice(skip, skip + limit),
      total: filtered.length,
      unreadCount,
    };
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(id: string): Promise<INotificationItem> {
    if (!id) throw new AppError('Notification ID is required', 400);

    let updated: any = null;
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      try {
        updated = await Notification.findByIdAndUpdate(
          id,
          { $set: { isRead: true, readAt: new Date() } },
          { new: true }
        ).lean();
        if (updated) {
          updated.id = updated._id ? updated._id.toString() : updated.id;
        }
      } catch {}
    }

    if (!updated) {
      const found = inMemoryNotifications.find((n) => n.id === id);
      if (!found) throw new AppError('Notification not found', 404);
      found.isRead = true;
      found.readAt = new Date();
      updated = found;
    }

    return updated;
  },

  /**
   * Mark all unread notifications as read for a recipient
   */
  async markAllAsRead(recipientId?: string, recipientType = 'admin'): Promise<{ modifiedCount: number }> {
    let modifiedCount = 0;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = { isRead: false, recipientType };
        if (recipientId) filter.recipientId = recipientId;
        const res = await Notification.updateMany(filter, { $set: { isRead: true, readAt: new Date() } });
        modifiedCount = res.modifiedCount;
      } catch {}
    } else {
      for (const n of inMemoryNotifications) {
        if (!n.isRead && n.recipientType === recipientType && (!recipientId || n.recipientId === recipientId)) {
          n.isRead = true;
          n.readAt = new Date();
          modifiedCount++;
        }
      }
    }

    return { modifiedCount };
  },

  async getStatus() {
    return {
      module: 'notifications',
      status: 'operational',
      timestamp: new Date().toISOString(),
    };
  },
};

export default notificationsService;
