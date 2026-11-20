import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';

export interface IPayment {
  id: string;
  paymentReference: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  paymentMethod: 'online' | 'cod' | 'upi';
  paymentStatus: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
  transactionDate: string;
  gatewayTransactionReference?: string;
  gatewaySignature?: string;
  collectedBy?: string;
}

const PaymentSchema = new Schema<IPayment>({
  id: { type: String, required: true, unique: true, index: true },
  paymentReference: { type: String, required: true, index: true },
  orderId: { type: String, required: true, index: true },
  orderNumber: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['online', 'cod', 'upi'], required: true },
  paymentStatus: {
    type: String,
    enum: ['pending', 'authorized', 'paid', 'failed', 'refunded'],
    default: 'pending',
    index: true,
  },
  transactionDate: { type: String, required: true, index: true },
  gatewayTransactionReference: { type: String },
  gatewaySignature: { type: String },
  collectedBy: { type: String },
});

applyCleanTransform(PaymentSchema);

export const PaymentModel: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
