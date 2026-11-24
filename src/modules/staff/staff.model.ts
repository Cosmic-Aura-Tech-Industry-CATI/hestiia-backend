import mongoose, { Schema, Model } from 'mongoose';
import type {
  IStaffMemberDocument,
  IStaffShiftDocument,
  StaffRole,
  StaffDepartment,
  StaffStatus,
  ShiftType,
  ShiftStatus,
} from './staff.interface.js';

export interface IStaffMemberModel extends Model<IStaffMemberDocument> {}
export interface IStaffShiftModel extends Model<IStaffShiftDocument> {}

// 1. Staff Member Schema
const staffMemberSchema = new Schema<IStaffMemberDocument>(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Staff member name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['chef', 'sous_chef', 'cook', 'waiter', 'captain', 'bartender', 'cashier', 'manager', 'delivery', 'staff'],
      default: 'staff',
      required: true,
      index: true,
    },
    department: {
      type: String,
      enum: ['kitchen', 'front_of_house', 'logistics', 'management'],
      default: 'kitchen',
      required: true,
      index: true,
    },
    branchId: {
      type: String,
      default: 'branch_shyam_nagar',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'on_leave', 'terminated', 'inactive'],
      default: 'active',
      index: true,
    },
    joiningDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    emergencyContact: {
      type: String,
      default: '',
    },
    hourlyRate: {
      type: Number,
      default: 0,
      min: [0, 'Hourly rate cannot be negative'],
    },
    notes: {
      type: String,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters'],
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

staffMemberSchema.index({ branchId: 1, status: 1 });
staffMemberSchema.index({ department: 1, role: 1, status: 1 });
staffMemberSchema.index({ name: 'text', email: 'text', phone: 'text', employeeId: 'text' });

// 2. Staff Shift Schema
const staffShiftSchema = new Schema<IStaffShiftDocument>(
  {
    shiftNumber: {
      type: String,
      required: [true, 'Shift number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    staffId: {
      type: String,
      required: [true, 'Staff ID is required'],
      index: true,
    },
    staffName: {
      type: String,
      required: [true, 'Staff name is required'],
      trim: true,
    },
    staffRole: {
      type: String,
      required: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      index: true,
    },
    branchId: {
      type: String,
      default: 'branch_shyam_nagar',
      index: true,
    },
    shiftType: {
      type: String,
      enum: ['morning', 'evening', 'night', 'full_day'],
      default: 'morning',
      index: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Shift start time is required'],
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    breakDurationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
      index: true,
    },
    clockInNotes: {
      type: String,
      default: '',
      maxlength: [300, 'Clock in notes cannot exceed 300 characters'],
    },
    clockOutNotes: {
      type: String,
      default: '',
      maxlength: [300, 'Clock out notes cannot exceed 300 characters'],
    },
    totalHours: {
      type: Number,
      default: 0,
      min: 0,
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

staffShiftSchema.index({ staffId: 1, status: 1 });
staffShiftSchema.index({ branchId: 1, status: 1, startTime: -1 });

export const StaffMember =
  (mongoose.models.StaffMember as IStaffMemberModel) ||
  mongoose.model<IStaffMemberDocument, IStaffMemberModel>('StaffMember', staffMemberSchema);

export const StaffShift =
  (mongoose.models.StaffShift as IStaffShiftModel) ||
  mongoose.model<IStaffShiftDocument, IStaffShiftModel>('StaffShift', staffShiftSchema);

export default { StaffMember, StaffShift };
