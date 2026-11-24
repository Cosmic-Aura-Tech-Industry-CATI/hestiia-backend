export interface RestaurantDetails {
  id?: string;
  restaurantName: string;
  tagline: string;
  eyebrow: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  openingHours: string;
  timezone: string;
  currency: string;
  currencySymbol: string;
  taxRatePercent: number;
  deliveryFee: number;
  minOrderValue: number;
  orderAcceptanceEnabled: boolean;
  tableReservationEnabled: boolean;
  invoicePrefix: string;
  zomatoRating: string;
  socialInstagram: string;
  socialFacebook: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface RestaurantPublicProfile {
  restaurantName: string;
  tagline: string;
  eyebrow: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  openingHours: string;
  timezone: string;
  currency: string;
  currencySymbol: string;
  taxRatePercent: number;
  deliveryFee: number;
  minOrderValue: number;
  orderAcceptanceEnabled: boolean;
  tableReservationEnabled: boolean;
  zomatoRating: string;
  socialInstagram: string;
  socialFacebook: string;
}

export interface RestaurantOperationalStatus {
  isOpen: boolean;
  orderAcceptanceEnabled: boolean;
  tableReservationEnabled: boolean;
  isOnlineOrderingAvailable: boolean;
  isTableReservationAvailable: boolean;
  openingHours: string;
  timezone: string;
  currentTime: string;
  dayOfWeek: string;
  message: string;
}

export interface RestaurantUpdatePayload {
  restaurantName?: string;
  tagline?: string;
  eyebrow?: string;
  description?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  openingHours?: string;
  timezone?: string;
  currency?: string;
  currencySymbol?: string;
  taxRatePercent?: number;
  deliveryFee?: number;
  minOrderValue?: number;
  orderAcceptanceEnabled?: boolean;
  tableReservationEnabled?: boolean;
  invoicePrefix?: string;
  zomatoRating?: string;
  socialInstagram?: string;
  socialFacebook?: string;
}

export interface RestaurantTogglePayload {
  enabled?: boolean;
  reason?: string;
}
