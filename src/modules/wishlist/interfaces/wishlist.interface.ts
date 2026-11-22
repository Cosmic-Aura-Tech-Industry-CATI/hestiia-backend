export interface IWishlistItem {
  menu_item_id: string;
  added_at: string | Date;
}

export interface IWishlist {
  id?: string;
  _id?: any;
  guest_id: string;
  items: IWishlistItem[];
  expires_at: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface IEnrichedWishlistItem {
  menu_item_id: string;
  name: string;
  slug?: string;
  description: string;
  price: number;
  image: string;
  category: string;
  available: boolean;
  isVeg?: boolean;
  added_at: string | Date;
}

export interface IWishlistResponse {
  guestId: string;
  totalItems: number;
  items: IEnrichedWishlistItem[];
  expiresAt: string | Date;
}
