import { Document } from 'mongoose';

export type DeliveryTrackingStatus =
  | 'unassigned'
  | 'assigned'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface IDeliveryLocation {
  lat: number;
  lng: number;
  updatedAt?: Date | string;
}

export interface IDeliveryZone {
  id: string;
  name: string;
  pincodes: string[];
  minOrderValue: number;
  deliveryFee: number;
  estimatedMinutes: number;
  isActive: boolean;
}

export interface IDeliveryAssignment {
  orderNumber: string;
  riderName: string;
  riderPhone: string;
  vehicleNumber?: string;
  trackingStatus: DeliveryTrackingStatus;
  currentLocation?: IDeliveryLocation;
  destinationAddress: string;
  customerName: string;
  customerPhone: string;
  estimatedArrival?: Date | string;
  deliveredAt?: Date | string;
  deliveryNotes?: string;
  otp?: string;
  assignedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IDeliveryAssignmentDocument extends IDeliveryAssignment, Document {
  id: string;
}

export interface ServiceabilityCheckResult {
  serviceable: boolean;
  pincode: string;
  zoneName?: string;
  deliveryFee: number;
  minOrderValue: number;
  estimatedMinutes: number;
  message?: string;
}
