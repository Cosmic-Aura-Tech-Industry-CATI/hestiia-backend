import mongoose, { Schema, Document } from 'mongoose';
import { IContactSettings } from './contact.interface.js';

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

// Prevent accidental multiple documents in MongoDB
contactSettingsSchema.index({ _id: 1 });

export const ContactSettings =
  (mongoose.models.ContactSettings as mongoose.Model<IContactSettingsDocument>) ||
  mongoose.model<IContactSettingsDocument>('ContactSettings', contactSettingsSchema);
