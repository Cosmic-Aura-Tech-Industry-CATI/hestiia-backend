export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
export type FulfillmentType = 'dine-in' | 'pickup' | 'delivery';
export type PaymentMethod = 'online' | 'cod' | 'upi';

export interface IOrderItem {
  dishId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
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
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  fulfillmentType: FulfillmentType;
  items: IOrderItem[];
  subtotal: number;
  taxAmount: number;
  deliveryCharge: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  notes?: string;
  statusHistory: IOrderStatusHistory[];
  invoiceNumber: string;
  createdAt: string;
  updatedAt: string;
}
