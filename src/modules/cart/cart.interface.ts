export interface ICartItem {
  dishId: string;
  name: string;
  price: number;
  priceInPaise: number;
  quantity: number;
  total: number;
  totalInPaise: number;
  image: string;
  notes?: string;
  addedAt: Date;
}

export interface ICart {
  id?: string;
  _id?: any;
  guestId: string;
  userId?: string;
  fulfillmentType: 'delivery' | 'dine-in' | 'pickup';
  items: ICartItem[];
  subtotal: number;
  subtotalInPaise: number;
  taxAmount: number;
  taxInPaise: number;
  deliveryCharge: number;
  deliveryInPaise: number;
  discountAmount: number;
  discountInPaise: number;
  grandTotal: number;
  grandTotalInPaise: number;
  appliedCoupon?: string;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
