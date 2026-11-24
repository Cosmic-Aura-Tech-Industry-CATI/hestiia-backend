import { Document } from 'mongoose';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';
export type NotificationRecipientType = 'customer' | 'staff' | 'admin';

export interface INotificationItem {
  id?: string;
  recipientType: NotificationRecipientType;
  recipientId?: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  isRead: boolean;
  readAt?: Date | string;
  metadata?: Record<string, any>;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface INotificationDocument extends Document, Omit<INotificationItem, 'id'> {
  id: string;
}

export interface CreateNotificationDTO {
  recipientType?: NotificationRecipientType;
  recipientId?: string;
  title: string;
  message: string;
  channel?: NotificationChannel;
  metadata?: Record<string, any>;
}

export interface NotificationQuery {
  recipientId?: string;
  recipientType?: NotificationRecipientType;
  isRead?: boolean | string;
  channel?: NotificationChannel;
  limit?: number;
  skip?: number;
}
