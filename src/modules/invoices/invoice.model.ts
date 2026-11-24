import mongoose, { Schema, Model } from 'mongoose';

export interface IInvoiceDocument extends mongoose.Document {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: Array<{
    dishId: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
    image?: string;
  }>;
  subtotal: number;
  taxAmount: number;
  deliveryCharge: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInvoiceModel extends Model<IInvoiceDocument> {}

const invoiceSchema = new Schema<IInvoiceDocument>(
  {
    invoiceNumber: {
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
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
    },
    customerAddress: {
      type: String,
      default: '',
    },
    items: [
      {
        dishId: { type: String, required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        total: { type: Number, required: true },
        image: { type: String },
      },
    ],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    deliveryCharge: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      default: 'cod',
    },
    paymentStatus: {
      type: String,
      default: 'pending',
    },
    issuedAt: {
      type: Date,
      default: Date.now,
      index: true,
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

// High-performance compound indexes for invoice lookup and fiscal reconciliation
invoiceSchema.index({ customerPhone: 1, issuedAt: -1 });
invoiceSchema.index({ paymentStatus: 1, issuedAt: -1 });
invoiceSchema.index({ createdAt: -1 });

export type Invoice = IInvoiceDocument;
export const Invoice =
  (mongoose.models.Invoice as IInvoiceModel) ||
  mongoose.model<IInvoiceDocument, IInvoiceModel>('Invoice', invoiceSchema);

export default Invoice;
