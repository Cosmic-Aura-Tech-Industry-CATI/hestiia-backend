import mongoose, { Schema, Model } from 'mongoose';

export interface IConversationDocument extends mongoose.Document {
  id: string;
  orderNumber: string;
  senderRole: 'customer' | 'admin' | 'system';
  senderName: string;
  text: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationModel extends Model<IConversationDocument> {}

const conversationSchema = new Schema<IConversationDocument>(
  {
    orderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    senderRole: {
      type: String,
      enum: ['customer', 'admin', 'system'],
      required: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// High performance compound indexes for chat retrieval and unread counters
conversationSchema.index({ orderNumber: 1, createdAt: 1 });
conversationSchema.index({ isRead: 1, senderRole: 1 });
conversationSchema.index({ orderNumber: 1, isRead: 1, senderRole: 1 });

export const Conversation =
  (mongoose.models.Conversation as IConversationModel) ||
  mongoose.model<IConversationDocument, IConversationModel>('Conversation', conversationSchema);

export default Conversation;
