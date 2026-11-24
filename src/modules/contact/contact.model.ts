import mongoose, { Schema, Document, Model } from 'mongoose';
import { IContactSettings, IContactDocument } from './contact.interface.js';

export type { IContactDocument } from './contact.interface.js';

export interface IContactSettingsDocument extends IContactSettings, Document {
  _id: mongoose.Types.ObjectId;
}

const contactSettingsSchema = new Schema<IContactSettingsDocument>(
  {
    phone: {
      number: {
        type: String,
        required: true,
        default: '+919876543210',
        trim: true,
      },
      enabled: {
        type: Boolean,
        required: true,
        default: true,
      },
    },
    email: {
      address: {
        type: String,
        required: true,
        default: 'restaurant@hestiia.com',
        trim: true,
        lowercase: true,
      },
      enabled: {
        type: Boolean,
        required: true,
        default: true,
      },
    },
    whatsapp: {
      number: {
        type: String,
        required: true,
        default: '919876543210',
        trim: true,
      },
      enabled: {
        type: Boolean,
        required: true,
        default: true,
      },
    },
  },
  {
    timestamps: true,
    collection: 'contact_settings',
    versionKey: false,
  }
);

contactSettingsSchema.index({ _id: 1 });

export const ContactSettings =
  (mongoose.models.ContactSettings as mongoose.Model<IContactSettingsDocument>) ||
  mongoose.model<IContactSettingsDocument>('ContactSettings', contactSettingsSchema);

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

contactSchema.index({ status: 1, createdAt: -1 });
contactSchema.index({ email: 1 });
contactSchema.index({ createdAt: -1 });

export const Contact =
  (mongoose.models.Contact as IContactModel) ||
  mongoose.model<IContactDocument, IContactModel>('Contact', contactSchema);

export default Contact;
