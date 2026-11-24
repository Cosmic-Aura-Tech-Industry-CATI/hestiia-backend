import mongoose, { Schema, Model } from 'mongoose';
import type { INotificationDocument, NotificationRecipientType, NotificationChannel } from './notifications.interface.js';

export type { INotificationDocument } from './notifications.interface.js';
export interface INotificationModel extends Model<INotificationDocument> {}

const notificationSchema = new Schema<INotificationDocument>(
  {
    recipientType: {
      type: String,
      enum: ['customer', 'staff', 'admin'],
      default: 'admin',
      required: true,
      index: true,
    },
    recipientId: {
      type: String,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    channel: {
      type: String,
      enum: ['in_app', 'email', 'sms', 'push'],
      default: 'in_app',
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientType: 1, createdAt: -1 });

export const Notification =
  (mongoose.models.Notification as INotificationModel) ||
  mongoose.model<INotificationDocument, INotificationModel>('Notification', notificationSchema);

export default Notification;
