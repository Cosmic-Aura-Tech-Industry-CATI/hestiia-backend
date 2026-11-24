import mongoose, { Schema, Model } from 'mongoose';
import type { ITableDocument, TableStatus, TableShape } from './table.interface.js';

export type { ITableDocument } from './table.interface.js';
export interface ITableModel extends Model<ITableDocument> {}

const tableSchema = new Schema<ITableDocument>(
  {
    tableNumber: {
      type: String,
      required: [true, 'Table number is required'],
      unique: true,
      trim: true,
    },
    zone: {
      type: String,
      required: [true, 'Table zone/section is required'],
      trim: true,
      default: 'AC Main Hall',
      index: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Seating capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      default: 4,
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'occupied', 'cleaning', 'maintenance'],
      default: 'available',
      index: true,
    },
    shape: {
      type: String,
      enum: ['square', 'round', 'rectangular', 'booth'],
      default: 'square',
    },
    qrCodeUrl: {
      type: String,
      default: '',
    },
    branchId: {
      type: String,
      default: 'branch_shyam_nagar',
      index: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: [300, 'Description cannot exceed 300 characters'],
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
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

tableSchema.index({ status: 1, zone: 1 });
tableSchema.index({ isActive: 1, status: 1, zone: 1 });
tableSchema.index({ branchId: 1, isActive: 1 });
tableSchema.index({ tableNumber: 'text', zone: 'text', description: 'text' });

export const Table =
  (mongoose.models.Table as ITableModel) ||
  mongoose.model<ITableDocument, ITableModel>('Table', tableSchema);

export default Table;
