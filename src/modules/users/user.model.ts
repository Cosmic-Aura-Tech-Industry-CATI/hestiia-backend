import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { BCRYPT_SALT_ROUNDS } from '../../shared/config/utils.js';
import { IUserDocument, UserRole, UserStatus } from './user.interface.js';

export type { IUserDocument } from './user.interface.js';
export interface IUserModel extends Model<IUserDocument> { }

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    username: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      index: true,
    },
    password: {
      type: String,
      select: false,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['ADMIN', 'STAFF', 'SUPERADMIN', 'MANAGER', 'admin', 'staff', 'superadmin', 'manager'],
        message: "Role must strictly be 'ADMIN' or 'STAFF'",
      },
      default: 'STAFF',
      set: (val: string) => {
        if (!val) return 'STAFF';
        const upper = val.toUpperCase().trim();
        return upper === 'STAFF' ? 'STAFF' : 'ADMIN';
      },
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'INACTIVE', 'active', 'inactive'],
        message: "Status must strictly be 'ACTIVE' or 'INACTIVE'",
      },
      default: 'ACTIVE',
      set: (val: string) => (val ? val.toUpperCase().trim() : 'ACTIVE'),
      required: true,
      index: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : '';
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Pre-save hook: Hash password with bcrypt before persisting
userSchema.pre('save', async function () {
  if (this.isModified('password') && this.password) {
    const saltRounds = Number(BCRYPT_SALT_ROUNDS) || 12;
    this.passwordHash = await bcrypt.hash(this.password, saltRounds);
    this.password = undefined; // Never persist plain text password
  }
});

// Compare candidate password with stored hash
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  const hash = this.passwordHash || this.password;
  if (!hash) return false;
  return bcrypt.compare(candidatePassword, hash);
};

userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: -1 });

export const User = (mongoose.models.User as IUserModel) || mongoose.model<IUserDocument, IUserModel>('User', userSchema);
export default User;