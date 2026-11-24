import mongoose, { Schema, Model } from 'mongoose';
import { IContactDocument } from './contact.interface.js';

export type { IContactDocument } from './contact.interface.js';

export interface IContactModel extends Model<IContactDocument> {}

const contactSchema = new Schema<IContactDocument>(
  {
    name: {
      type: String,
      required: [true, 'Sender name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Contact email address is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [150, 'Subject cannot exceed 150 characters'],
      default: 'general',
    },
    message: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'responded', 'archived'],
      default: 'new',
    },
    responseNotes: {
      type: String,
      trim: true,
      default: '',
    },
    respondedAt: {
      type: Date,
    },
    respondedBy: {
      type: String,
      trim: true,
      default: '',
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
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

// High performance compound indexes for fast filtering, pagination and email lookups
contactSchema.index({ status: 1, createdAt: -1 });
contactSchema.index({ email: 1 });
contactSchema.index({ createdAt: -1 });

export const Contact =
  (mongoose.models.Contact as IContactModel) ||
  mongoose.model<IContactDocument, IContactModel>('Contact', contactSchema);

export default Contact;
