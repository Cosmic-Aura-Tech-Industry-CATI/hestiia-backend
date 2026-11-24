export interface ICartItem {
  dishId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  image?: string;
}

export interface IAppliedOffer {
  offerId: string;
  title: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  discountAmount: number;
}

export interface ICart {
  _id: string;
  cartId?: string;
  guestId?: string;
  customerId?: string;
  items: ICartItem[];
  subtotal: number;
  discountAmount: number;
  appliedOffer?: IAppliedOffer | null;
  taxAmount: number;
  deliveryFee: number;
  payableAmount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}
