import mongoose, { Schema, Document } from 'mongoose';
import { IStaffMember } from '../interfaces/staff.interface.js';

export interface IStaffDocument extends Omit<IStaffMember, '_id'>, Document {}

const StaffSchema = new Schema<IStaffDocument>(
  {
    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: {
        values: ['staff'],
        message: "Only 'staff' role is permitted",
      },
      default: 'staff',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret._id = ret._id ? ret._id.toString() : ret.id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound and single unique indexes
StaffSchema.index({ email: 1 }, { unique: true });
StaffSchema.index({ phone: 1 }, { unique: true });
StaffSchema.index({ isActive: 1, createdAt: -1 });

export const Staff =
  (mongoose.models.Staff as mongoose.Model<IStaffDocument>) ||
  mongoose.model<IStaffDocument>('Staff', StaffSchema);

export default Staff;
