import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { UPLOADS_DIR } from './utils.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'staff' | 'superadmin' | 'manager';
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
  priceInPaise?: number;
  quantity: number;
  total: number;
  totalInPaise?: number;
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
  idempotencyKey?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress?: string;
  fulfillmentType: 'dine-in' | 'pickup' | 'delivery';
  items: OrderItem[];
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
  paymentMethod: 'online' | 'cod' | 'upi';
  paymentStatus: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'awaiting_verification';
  orderStatus: 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'completed' | 'cancelled';
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
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
  amountInPaise?: number;
  paymentMethod: 'online' | 'cod' | 'upi';
  paymentStatus: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'awaiting_verification';
  transactionDate: string;
  gatewayOrderId?: string;
  gatewayTransactionReference?: string;
  gatewaySignature?: string;
  upiUtr?: string;
  upiSubmittedAt?: string;
  upiVerifiedAt?: string;
  upiVerifiedBy?: string;
  refundReference?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: string;
  collectedBy?: string;
  idempotencyKey?: string;
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
  events?: any[];
  eventMedia?: any[];
  eventInquiries?: any[];
  wishlists?: any[];
  media?: any[];
  gallerySections?: any[];
  mediaModerations?: any[];
  staff?: any[];
  offers?: any[];
  offerRedemptions?: any[];
  carts?: any[];
  contactSettings?: any;
}

class JSONDatabase {
  private state: DatabaseState;

  constructor() {
    this.ensureDirs();
    this.state = this.load();
  }

  private ensureDirs() {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  }

  private load(): DatabaseState {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.users && Array.isArray(parsed.users)) {
          parsed.users.forEach((u: any) => {
            if (typeof u.tokenVersion !== 'number') {
              u.tokenVersion = 0;
            }
          });
        }
        if (!parsed.events) parsed.events = [];
        if (!parsed.eventMedia) parsed.eventMedia = [];
        if (!parsed.eventInquiries) parsed.eventInquiries = [];
        if (!parsed.wishlists) parsed.wishlists = [];
        if (!parsed.media) parsed.media = [];
        if (!parsed.gallerySections) parsed.gallerySections = [];
        if (!parsed.mediaModerations) parsed.mediaModerations = [];
        if (!parsed.staff) parsed.staff = [];
        if (!parsed.offers) parsed.offers = [];
        if (!parsed.offerRedemptions) parsed.offerRedemptions = [];
        if (!parsed.carts) parsed.carts = [];
        if (!parsed.contactSettings) {
          parsed.contactSettings = {
            phone: { number: '+919876543210', enabled: true },
            email: { address: 'restaurant@hestiia.com', enabled: true },
            whatsapp: { number: '919876543210', enabled: true },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          };
        }
        return parsed;
      } catch (err) {
        console.error('Error reading db.json, initializing fresh store:', err);
      }
    }
    const fresh = this.getSeedData();
    this.save(fresh);
    return fresh;
  }

  private save(data?: DatabaseState) {
    if (data) this.state = data;
    try {
      const tmpFile = `${DB_FILE}.${Date.now()}-${Math.random().toString(36).substring(2, 6)}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.state, null, 2), 'utf-8');
      try {
        fs.renameSync(tmpFile, DB_FILE);
      } catch {
        fs.copyFileSync(tmpFile, DB_FILE);
        fs.unlinkSync(tmpFile);
      }
    } catch (err) {
      console.error('Failed to write db.json:', err);
    }
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public updateState(updater: (state: DatabaseState) => void): DatabaseState {
    updater(this.state);
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

    // Persist to MongoDB Atlas if connected
    try {
      import('mongoose').then((mongoose) => {
        if (mongoose.default.connection?.readyState === 1 && mongoose.default.models.AuditLog) {
          mongoose.default.models.AuditLog.create({
            action,
            user,
            details,
            ip,
            timestamp: new Date(),
          }).catch(() => {});
        }
      }).catch(() => {});
    } catch {}
  }

  private getSeedData(): DatabaseState {
    const initialUsers: AdminUser[] = [];

    const initialSettings: RestaurantSettings = {
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
      taxRatePercent: 5.0, // 5% GST on Restaurant Services
      deliveryFee: 40,
      minOrderValue: 200,
      orderAcceptanceEnabled: true,
      tableReservationEnabled: true,
      invoicePrefix: 'HST-',
      zomatoRating: '4.5',
      socialInstagram: 'https://instagram.com/hestiiarestaurant',
      socialFacebook: 'https://facebook.com/hestiiarestaurant',
    };

    const initialCategories: FoodCategory[] = [];

    const initialDishes: FoodItem[] = [];
    const initialPromotions: Promotion[] = [];
    const initialGallery: GalleryPhoto[] = [];

    const initialCustomers: Customer[] = [];
    const initialOrders: Order[] = [];
    const initialPayments: Payment[] = [];
    const initialInvoices: Invoice[] = [];
    const initialBookings: TableBooking[] = [];
    const initialPartyInquiries: PartyInquiry[] = [];
    const initialReviews: ReviewItem[] = [];

    return {
      users: initialUsers,
      settings: initialSettings,
      categories: initialCategories,
      dishes: initialDishes,
      orders: initialOrders,
      customers: initialCustomers,
      payments: initialPayments,
      invoices: initialInvoices,
      bookings: initialBookings,
      partyInquiries: initialPartyInquiries,
      promotions: initialPromotions,
      gallery: initialGallery,
      reviews: initialReviews,
      staff: [],
      offers: [],
      offerRedemptions: [],
      carts: [],
      contactSettings: {
        phone: { number: '+919876543210', enabled: true },
        email: { address: 'restaurant@hestiia.com', enabled: true },
        whatsapp: { number: '919876543210', enabled: true },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      auditLogs: [
        {
          id: 'aud_seed',
          action: 'SYSTEM_INITIALIZATION',
          user: 'System Bootstrapper',
          details: 'Initialized Hestiia Restaurant Admin Database with seed menu and settings.',
          timestamp: '2026-10-01T10:00:00.000Z',
        },
      ],
    };
  }
}

export const db = new JSONDatabase();
