import mongoose, { Schema, Model } from 'mongoose';

export interface IPaymentDocument extends mongoose.Document {
  id: string;
  paymentReference: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  amountInPaise?: number;
  paymentMethod: 'online' | 'cod' | 'upi';
  paymentStatus: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'awaiting_verification';
  transactionDate: Date;
  gatewayOrderId?: string;
  gatewayTransactionReference?: string;
  gatewaySignature?: string;
  upiUtr?: string;
  upiSubmittedAt?: Date;
  upiVerifiedAt?: Date;
  upiVerifiedBy?: string;
  refundReference?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  collectedBy?: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentModel extends Model<IPaymentDocument> {}

const paymentSchema = new Schema<IPaymentDocument>(
  {
    paymentReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountInPaise: {
      type: Number,
    },
    paymentMethod: {
      type: String,
      enum: ['online', 'cod', 'upi'],
      required: true,
      default: 'cod',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'authorized', 'paid', 'failed', 'refunded', 'awaiting_verification'],
      required: true,
      default: 'pending',
      index: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    gatewayOrderId: {
      type: String,
      sparse: true,
    },
    gatewayTransactionReference: {
      type: String,
      sparse: true,
    },
    gatewaySignature: {
      type: String,
    },
    upiUtr: {
      type: String,
      sparse: true,
      trim: true,
    },
    upiSubmittedAt: {
      type: Date,
    },
    upiVerifiedAt: {
      type: Date,
    },
    upiVerifiedBy: {
      type: String,
    },
    refundReference: {
      type: String,
    },
    refundAmount: {
      type: Number,
    },
    refundReason: {
      type: String,
    },
    refundedAt: {
      type: Date,
    },
    collectedBy: {
      type: String,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
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

// High-performance compound indexes for payment lookups, gateway verification, and ledger reconciliation
paymentSchema.index({ orderNumber: 1, paymentStatus: 1 });
paymentSchema.index({ paymentStatus: 1, transactionDate: -1 });
paymentSchema.index({ paymentMethod: 1, transactionDate: -1 });
paymentSchema.index({ transactionDate: -1, createdAt: -1 });
paymentSchema.index({ createdAt: -1 });

export type Payment = IPaymentDocument;
export const Payment =
  (mongoose.models.Payment as IPaymentModel) ||
  mongoose.model<IPaymentDocument, IPaymentModel>('Payment', paymentSchema);

export default Payment;
