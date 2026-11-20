import mongoose, { Schema, Model } from 'mongoose';
import { applyCleanTransform } from './_schema';
import { IOrderItem } from './Order.model';

export interface IInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: IOrderItem[];
  subtotal: number;
  taxAmount: number;
  deliveryCharge: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  issuedAt: string;
}

const InvoiceItemSchema = new Schema<IOrderItem>(
  {
    dishId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    total: { type: Number, required: true },
    image: { type: String },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>({
  id: { type: String, required: true, unique: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, required: true, index: true },
  orderNumber: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerAddress: { type: String },
  items: { type: [InvoiceItemSchema], default: [] },
  subtotal: { type: Number, required: true },
  taxAmount: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  paymentStatus: { type: String, required: true },
  issuedAt: { type: String, required: true, index: true },
});

applyCleanTransform(InvoiceSchema);

export const InvoiceModel: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);
