import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from './utils.js';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  username: string;
  passwordHash: string;
  role: 'superadmin' | 'manager' | 'staff';
  active: boolean;
  tokenVersion?: number;
  lastLogin?: string;
  createdAt: string;
}

export interface FoodCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  icon?: string;
}

export interface FoodItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  fullDescription: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  isVeg: boolean;
  isSignature?: boolean;
  spiceLevel: 1 | 2 | 3;
  preparationTime: string;
  ingredients: string[];
  chefNote?: string;
  available: boolean;
  displayOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  dishId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  image?: string;
}

export interface OrderStatusHistoryItem {
  status: string;
  timestamp: string;
  actor: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress?: string;
  fulfillmentType: 'dine-in' | 'pickup' | 'delivery';
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  deliveryCharge: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: 'online' | 'cod' | 'upi';
  paymentStatus: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
  orderStatus: 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'completed' | 'cancelled';
  notes?: string;
  statusHistory: OrderStatusHistoryItem[];
  invoiceNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  paymentReference: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  paymentMethod: 'online' | 'cod' | 'upi';
  paymentStatus: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
  transactionDate: string;
  gatewayTransactionReference?: string;
  gatewaySignature?: string;
  collectedBy?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  deliveryCharge: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  issuedAt: string;
}

export interface TableBooking {
  id: string;
  bookingRef?: string;
  customerName: string;
  phone: string;
  email?: string;
  date: string;
  time: string;
  guests: string;
  occasion: string;
  specialRequests?: string;
  status: 'new' | 'contacted' | 'confirmed' | 'rescheduled' | 'rejected' | 'completed' | 'cancelled';
  allocatedTable?: string;
  confirmedAt?: string;
  confirmationMethod?: 'on-screen' | 'whatsapp' | 'call';
  holdPolicy?: string;
  staffNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartyInquiry {
  id: string;
  customerName: string;
  phone: string;
  email?: string;
  eventType: 'birthday' | 'anniversary' | 'corporate' | 'family_gathering' | 'other';
  preferredDate: string;
  guestCount: number;
  budgetRange?: string;
  specialRequirements?: string;
  status: 'new' | 'contacted' | 'confirmed' | 'rejected';
  staffNotes?: string;
  followUpDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  originalPrice: number;
  serves: string;
  badge: string;
  items: string[];
  image: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface GalleryPhoto {
  id: string;
  title: string;
  category: string;
  image: string;
  description: string;
  isFeatured: boolean;
  displayOrder: number;
}

export interface ReviewItem {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  dishName?: string;
  source: 'website' | 'google' | 'direct';
  isApproved: boolean;
  staffReply?: string;
  createdAt: string;
}

export interface RestaurantSettings {
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
  taxRatePercent: number; // 5%
  deliveryFee: number;
  minOrderValue: number;
  orderAcceptanceEnabled: boolean;
  tableReservationEnabled: boolean;
  invoicePrefix: string;
  zomatoRating: string;
  socialInstagram: string;
  socialFacebook: string;
}

export interface AuditLog {
  id: string;
  action: string;
  user: string;
  details: string;
  ip?: string;
  timestamp: string;
}

export interface DatabaseState {
  users: AdminUser[];
  settings: RestaurantSettings;
  categories: FoodCategory[];
  dishes: FoodItem[];
  orders: Order[];
  customers: Customer[];
  payments: Payment[];
  invoices: Invoice[];
  bookings: TableBooking[];
  partyInquiries: PartyInquiry[];
  promotions: Promotion[];
  gallery: GalleryPhoto[];
  reviews: ReviewItem[];
  auditLogs: AuditLog[];
}

class JSONDatabase {
  private state: DatabaseState;

  constructor() {
    this.ensureDirs();
    this.state = this.getSeedData();
  }

  private ensureDirs() {
    if (!fs.existsSync(UPLOADS_DIR)) {
      try {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      } catch {
        // ignore if cannot create in some environments
      }
    }
  }

  private save(data?: DatabaseState) {
    if (data) this.state = data;
    // In-memory state only - no local db.json created or saved
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public updateState(updater: (state: DatabaseState) => void): DatabaseState {
    updater(this.state);
    this.save();
    return this.state;
  }

  public logAudit(action: string, user: string, details: string, ip?: string) {
    const log: AuditLog = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      action,
      user,
      details,
      ip,
      timestamp: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(log);
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 500);
    }
    this.save();
  }

  private getSeedData(): DatabaseState {
    const defaultSettings: RestaurantSettings = {
      restaurantName: 'HESTIIA RESTAURANT',
      tagline: 'Flavours That Stay With You',
      eyebrow: 'A MODERN INDIAN DINING EXPERIENCE',
      description: 'Discover a memorable dining experience with rich Indian flavours, thoughtfully crafted dishes and an ambience made for every occasion in Shyam Nagar, Kanpur.',
      address: 'PAC Road, Shyam Nagar, Kanpur, Uttar Pradesh 208013',
      phone: '+91 78808 40622',
      whatsapp: '917880840622',
      email: 'reservations@hestiia.com',
      openingHours: 'Monday – Sunday: 12:00 PM – 11:30 PM',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      currencySymbol: '₹',
      taxRatePercent: 5.0,
      deliveryFee: 40,
      minOrderValue: 200,
      orderAcceptanceEnabled: true,
      tableReservationEnabled: true,
      invoicePrefix: 'HST-',
      zomatoRating: '4.5',
      socialInstagram: 'https://instagram.com/hestiiarestaurant',
      socialFacebook: 'https://facebook.com/hestiiarestaurant',
    };

    return {
      users: [],
      settings: defaultSettings,
      categories: [],
      dishes: [],
      orders: [],
      customers: [],
      payments: [],
      invoices: [],
      bookings: [],
      partyInquiries: [],
      promotions: [],
      gallery: [],
      reviews: [],
      auditLogs: [],
    };
  }
}

export const db = new JSONDatabase();
