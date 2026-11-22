export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'awaiting_verification';
export type FulfillmentType = 'dine-in' | 'pickup' | 'delivery';
export type PaymentMethod = 'online' | 'cod' | 'upi';

export interface IOrderItem {
  dishId: string;
  name: string;
  price: number;
  priceInPaise?: number;
  quantity: number;
  total: number;
  totalInPaise?: number;
  image?: string;
}

export interface IOrderStatusHistory {
  status: string;
  timestamp: string;
  actor: string;
  note?: string;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  idempotencyKey?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  fulfillmentType: FulfillmentType;
  items: IOrderItem[];
  subtotal: number;
  subtotalInPaise?: number;
  taxAmount: number;
  taxInPaise?: number;
  deliveryCharge: number;
  deliveryInPaise?: number;
  discountAmount: number;
  discountInPaise?: number;
  grandTotal: number;
  grandTotalInPaise?: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  notes?: string;
  statusHistory: IOrderStatusHistory[];
  invoiceNumber: string;
  createdAt: string;
  updatedAt: string;
}
