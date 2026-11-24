import mongoose, { Schema, Model } from 'mongoose';
import { IDeliveryAssignmentDocument } from './delivery.interface.js';

export type { IDeliveryAssignmentDocument } from './delivery.interface.js';

export interface IDeliveryAssignmentModel extends Model<IDeliveryAssignmentDocument> {}

const deliveryAssignmentSchema = new Schema<IDeliveryAssignmentDocument>(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
      trim: true,
    },
    riderName: {
      type: String,
      required: [true, 'Rider name is required'],
      trim: true,
      maxlength: [100, 'Rider name cannot exceed 100 characters'],
    },
    riderPhone: {
      type: String,
      required: [true, 'Rider phone is required'],
      trim: true,
    },
    vehicleNumber: {
      type: String,
      trim: true,
      default: '',
    },
    trackingStatus: {
      type: String,
      enum: ['unassigned', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'failed', 'cancelled'],
      default: 'assigned',
    },
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number },
      updatedAt: { type: Date, default: Date.now },
    },
    destinationAddress: {
      type: String,
      required: [true, 'Destination address is required'],
      trim: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    customerPhone: {
      type: String,
      trim: true,
      default: '',
    },
    estimatedArrival: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    deliveryNotes: {
      type: String,
      trim: true,
      default: '',
    },
    otp: {
      type: String,
      trim: true,
      default: '',
    },
    assignedBy: {
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

// High performance compound indexes for dispatching and tracking queries
deliveryAssignmentSchema.index({ trackingStatus: 1, createdAt: -1 });
deliveryAssignmentSchema.index({ riderPhone: 1, trackingStatus: 1 });

export const DeliveryAssignment =
  (mongoose.models.DeliveryAssignment as IDeliveryAssignmentModel) ||
  mongoose.model<IDeliveryAssignmentDocument, IDeliveryAssignmentModel>(
    'DeliveryAssignment',
    deliveryAssignmentSchema
  );

export default DeliveryAssignment;
