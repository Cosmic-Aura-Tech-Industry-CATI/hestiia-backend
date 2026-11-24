export type DiscountType = 'fixed' | 'percentage';
export type OfferPlacement = 'home' | 'menu';

export interface IOffer {
  _id: string;
  id?: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number | null;
  startDate: string | Date;
  endDate: string | Date;
  placements: OfferPlacement[];
  bannerImage: string;
  termsAndConditions: string[];
  displayPriority: number;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ICreateOfferDTO {
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue?: number;
  maxDiscount?: number | null;
  startDate: string | Date;
  endDate: string | Date;
  placements?: OfferPlacement[];
  bannerImage?: string;
  termsAndConditions?: string[];
  displayPriority?: number;
  isActive?: boolean;
}

export interface IUpdateOfferDTO {
  title?: string;
  description?: string;
  discountType?: DiscountType;
  discountValue?: number;
  minOrderValue?: number;
  maxDiscount?: number | null;
  startDate?: string | Date;
  endDate?: string | Date;
  placements?: OfferPlacement[];
  bannerImage?: string;
  termsAndConditions?: string[];
  displayPriority?: number;
  isActive?: boolean;
}

export interface IOfferQuery {
  page?: string | number;
  limit?: string | number;
  search?: string;
  status?: 'active' | 'inactive' | 'expired' | 'upcoming' | 'archived' | 'all';
  discountType?: 'fixed' | 'percentage';
  placement?: 'home' | 'menu';
  sortBy?: 'createdAt' | 'endDate' | 'displayPriority' | 'discountValue';
  order?: 'asc' | 'desc';
}

export interface IOfferSummary {
  totalOffers: number;
  activeOffers: number;
  inactiveOffers: number;
  upcomingOffers: number;
  expiredOffers: number;
  archivedOffers: number;
  totalRedemptions: number;
  totalDiscountProvided: number;
}

export interface IOfferAnalytics {
  offerId: string;
  title: string;
  totalRedemptions: number;
  totalDiscountProvided: number;
  totalOrders: number;
  createdAt: string | Date;
  endDate: string | Date;
  status: string;
}

export interface IOfferRedemption {
  _id: string;
  offerId: string;
  orderId: string;
  discountAmount: number;
  orderSubtotal: number;
  redeemedAt: string | Date;
}
