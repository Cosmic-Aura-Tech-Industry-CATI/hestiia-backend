import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface IAdminUser {
  id: string;
  name: string;
  email: string;
  username: string;
  passwordHash: string;
  role: 'superadmin' | 'manager' | 'staff';
  active: boolean;
  tokenVersion: number;
  lastLogin?: string;
  createdAt: string;
}

const UserSchema = new Schema<IAdminUser>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'manager', 'staff'], required: true },
  active: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0 },
  lastLogin: { type: String },
  createdAt: { type: String, required: true },
});

applyCleanTransform(UserSchema);

export const UserModel: Model<IAdminUser> =
  mongoose.models.User || mongoose.model<IAdminUser>('User', UserSchema);
