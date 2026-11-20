import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { DATA_DIR, UPLOADS_DIR } from './utils.js';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  username: string;
  passwordHash: string;
  role: 'superadmin' | 'manager' | 'staff';
  active: boolean;
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

const DB_FILE = path.join(DATA_DIR, 'db.json');

class JSONDatabase {
  private state: DatabaseState;

  constructor() {
    this.ensureDirs();
    this.state = this.load();
  }

  private ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  }

  private load(): DatabaseState {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
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
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write db.json:', err);
    }
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
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('Admin@Hestiia2026', salt);

    const initialUsers: AdminUser[] = [
      {
        id: 'usr_admin_1',
        name: 'Hestiia Administrator',
        email: 'admin@hestiia.com',
        username: 'admin',
        passwordHash,
        role: 'superadmin',
        active: true,
        createdAt: '2026-10-01T10:00:00.000Z',
      },
      {
        id: 'usr_manager_1',
        name: 'Floor Manager (Shyam Nagar)',
        email: 'manager@hestiia.com',
        username: 'manager',
        passwordHash: bcrypt.hashSync('Manager@Hestiia2026', salt),
        role: 'manager',
        active: true,
        createdAt: '2026-10-05T10:00:00.000Z',
      },
    ];

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

    const initialCategories: FoodCategory[] = [
      { id: 'cat-main', name: 'Main Course', slug: 'main-course', description: 'Slow-simmered handi gravies and aromatic curries', displayOrder: 1, isActive: true },
      { id: 'cat-biryani', name: 'Biryani', slug: 'biryani', description: 'Fragrant dum cooked long-grain basmati delicacies', displayOrder: 2, isActive: true },
      { id: 'cat-starters', name: 'Starters', slug: 'starters', description: 'Tantalizing appetizers crafted for warm beginnings', displayOrder: 3, isActive: true },
      { id: 'cat-kebabs', name: 'Kebabs', slug: 'kebabs', description: 'Charcoal-grilled succulent tandoori preparations', displayOrder: 4, isActive: true },
      { id: 'cat-chinese', name: 'Chinese', slug: 'chinese', description: 'Wok-tossed Indo-Chinese rice and sizzling appetisers', displayOrder: 5, isActive: true },
      { id: 'cat-noodles', name: 'Noodles', slug: 'noodles', description: 'Signature stir-fried noodles with farm-fresh greens', displayOrder: 6, isActive: true },
      { id: 'cat-desserts', name: 'Desserts', slug: 'desserts', description: 'Royal Indian confections and modern artisan sweets', displayOrder: 7, isActive: true },
      { id: 'cat-beverages', name: 'Beverages', slug: 'beverages', description: 'Chilled mocktails, smoked chaas and artisanal coolers', displayOrder: 8, isActive: true },
    ];

    const initialDishes: FoodItem[] = [
      {
        id: 'handi-paneer',
        name: 'Handi Paneer',
        slug: 'handi-paneer',
        category: 'Main Course',
        description: 'Rich, aromatic curry with soft paneer cubes and traditional Indian spices.',
        fullDescription: 'Fresh malai paneer simmered in an earthenware clay pot with freshly crushed coriander seeds, Kashmiri red chilies, and a velvety onion-tomato masala enriched with churned butter and fenugreek.',
        price: 325,
        compareAtPrice: 360,
        image: '/images/dishes/handi-paneer.jpg',
        isVeg: true,
        isSignature: true,
        spiceLevel: 2,
        preparationTime: '20 mins',
        ingredients: ['Malai Paneer', 'Earthen Pot Masala', 'Fenugreek', 'Clay Pot Gravy', 'Desi Ghee'],
        chefNote: 'Slow-simmered in clay handi to impart authentic rustic smoked earthiness.',
        available: true,
        displayOrder: 1,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'paneer-lababdar',
        name: 'Paneer Lababdar',
        slug: 'paneer-lababdar',
        category: 'Main Course',
        description: 'Creamy tomato-based gravy enriched with grated paneer and coriander.',
        fullDescription: 'Succulent cubes of cottage cheese enveloped in a luscious, mildly sweet and tangy gravy of vine-ripened tomatoes, cashew butter, ginger juliennes and aromatic cardamom.',
        price: 365,
        image: '/images/dishes/paneer-lababdar.jpg',
        isVeg: true,
        isSignature: true,
        spiceLevel: 1,
        preparationTime: '22 mins',
        ingredients: ['Cottage Cheese', 'Cashew Cream', 'Vine Tomatoes', 'Ginger Juliennes', 'Mace'],
        chefNote: 'Finished with a drizzle of heavy cream and slow-roasted cumin butter.',
        available: true,
        displayOrder: 2,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'veg-biryani',
        name: 'Veg Biryani',
        slug: 'veg-biryani',
        category: 'Biryani',
        description: 'Fragrant long-grain basmati with garden vegetables, saffron and herbs.',
        fullDescription: 'Aromatic Daawat basmati rice sealed with dough and slow-cooked over low embers (Dum) with baby carrots, French beans, cauliflower florets, Kashmiri saffron milk and fresh garden mint.',
        price: 344,
        image: '/images/dishes/veg-biryani.jpg',
        isVeg: true,
        isSignature: true,
        spiceLevel: 2,
        preparationTime: '25 mins',
        ingredients: ['Aged Basmati', 'Seasonal Farm Veggies', 'Kashmiri Saffron', 'Mint & Coriander', 'Crispy Onions'],
        chefNote: 'Served with chilled pomegranate burani raita and spicy salan.',
        available: true,
        displayOrder: 3,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'hyderabadi-biryani',
        name: 'Hyderabadi Dum Biryani',
        slug: 'hyderabadi-biryani',
        category: 'Biryani',
        description: 'Authentic Nizami spice blend layered with basmati and fried onions.',
        fullDescription: 'Steeped in royal Nizami tradition, layers of long-grain rice infused with crushed star anise, cinnamon quills, marinated soya chaap, caramelized birista, and saffron milk.',
        price: 385,
        image: '/images/dishes/hyderabadi-biryani.jpg',
        isVeg: true,
        isSignature: false,
        spiceLevel: 3,
        preparationTime: '25 mins',
        ingredients: ['Basmati Rice', 'Soya Chaap', 'Star Anise', 'Kashmiri Saffron', 'Birista Onions'],
        chefNote: 'Steamed in copper degh to lock in the fragrant steam.',
        available: true,
        displayOrder: 4,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'chaap-tikka-biryani',
        name: 'Chaap Tikka Biryani',
        slug: 'chaap-tikka-biryani',
        category: 'Biryani',
        description: 'Tandoor-smoked marinated soya chaap layered with fragrant spiced rice.',
        fullDescription: 'Plump soya chaap chunks marinated in mustard oil, hung curd, and roasted gram flour, charred over charcoal and then folded into fragrant saffron basmati rice.',
        price: 395,
        image: '/images/dishes/chaap-tikka-biryani.jpg',
        isVeg: true,
        isSignature: true,
        spiceLevel: 2,
        preparationTime: '25 mins',
        ingredients: ['Tandoori Soya Chaap', 'Aged Basmati', 'Hung Curd Marinade', 'Mint Leaves', 'Kewra Water'],
        chefNote: 'Smoked with charcoal embers and clove essence before serving.',
        available: true,
        displayOrder: 5,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'paneer-65',
        name: 'Paneer 65',
        slug: 'paneer-65',
        category: 'Starters',
        description: 'Crispy fried paneer tossed in fiery curry leaves and mustard seeds.',
        fullDescription: 'Crisp paneer bites dusted with rice flour and Southern spices, quick-fried and tossed in a sizzling tempering of curry leaves, crushed black pepper, green chilies and tangy curd.',
        price: 295,
        image: '/images/dishes/paneer-65.jpg',
        isVeg: true,
        isSignature: false,
        spiceLevel: 3,
        preparationTime: '15 mins',
        ingredients: ['Paneer Batons', 'Fresh Curry Leaves', 'Black Pepper', 'Mustard Seeds', 'Tangy Curd'],
        chefNote: 'Tossed fresh per order so the exterior maintains its signature crackle.',
        available: true,
        displayOrder: 6,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'chilli-potato',
        name: 'Crispy Honey Chilli Potato',
        slug: 'chilli-potato',
        category: 'Chinese',
        description: 'Golden fried potato fingers coated in a spicy sweet garlic sauce.',
        fullDescription: 'Twice-fried crisp potato batons tossed in a flaming wok with garlic, ginger, dark soy, red chili paste, wild forest honey, and toasted white sesame seeds.',
        price: 245,
        image: '/images/dishes/chilli-potato.jpg',
        isVeg: true,
        isSignature: false,
        spiceLevel: 2,
        preparationTime: '15 mins',
        ingredients: ['Crisp Potatoes', 'Wild Forest Honey', 'Toasted Sesame', 'Dark Soy', 'Spring Onions'],
        chefNote: 'Garnished with toasted sesame and fine scallion curls.',
        available: true,
        displayOrder: 7,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'dahi-kebab',
        name: 'Dahi Ke Kebab',
        slug: 'dahi-kebab',
        category: 'Kebabs',
        description: 'Velvety hung curd patties with a golden crust and aromatic herb filling.',
        fullDescription: 'Pillowy patties of hand-hung creamy yogurt, delicately spiked with chopped mint, green chilies, roasted cashew nuts, and roasted cumin seeds, shallow pan-seared in desi ghee.',
        price: 315,
        image: '/images/dishes/dahi-kebab.jpg',
        isVeg: true,
        isSignature: true,
        spiceLevel: 1,
        preparationTime: '18 mins',
        ingredients: ['Hung Yogurt', 'Cashew Crunch', 'Roasted Cumin', 'Fresh Mint', 'Desi Ghee'],
        chefNote: 'Crisp on the outside, melts like velvet on the tongue.',
        available: true,
        displayOrder: 8,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'haryali-kebab',
        name: 'Haryali Paneer Tikka',
        slug: 'haryali-kebab',
        category: 'Kebabs',
        description: 'Tandoori cottage cheese cubes marinated in mint, coriander and spices.',
        fullDescription: 'Thick slabs of fresh malai paneer steeped in a rich emerald paste of garden mint, coriander, baby spinach, roasted cumin and rock salt, skewered with bell peppers and roasted in clay oven.',
        price: 335,
        image: '/images/dishes/haryali-kebab.jpg',
        isVeg: true,
        isSignature: false,
        spiceLevel: 2,
        preparationTime: '20 mins',
        ingredients: ['Malai Paneer', 'Mint & Coriander Paste', 'Tandoori Spices', 'Bell Peppers', 'Rock Salt'],
        chefNote: 'Basted with butter and chaat masala straight from the tandoor.',
        available: true,
        displayOrder: 9,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'spring-roll',
        name: 'Hestiia Golden Spring Rolls',
        slug: 'spring-roll',
        category: 'Starters',
        description: 'Crisp pastry wrappers stuffed with shredded wok vegetables and glass noodles.',
        fullDescription: 'Paper-thin golden pastry rolls packed with julienned cabbage, carrots, bell peppers, bean sprouts and glass noodles, served with sweet chili dip and hot garlic sauce.',
        price: 235,
        image: '/images/dishes/spring-roll.jpg',
        isVeg: true,
        isSignature: false,
        spiceLevel: 1,
        preparationTime: '15 mins',
        ingredients: ['Spring Roll Wrappers', 'Julienne Veggies', 'Glass Noodles', 'Sweet Chili Dip', 'Sesame Oil'],
        chefNote: 'Fried to a golden shatteringly crisp perfection.',
        available: true,
        displayOrder: 10,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'paneer-manchurian',
        name: 'Wok Paneer Manchurian',
        slug: 'paneer-manchurian',
        category: 'Chinese',
        description: 'Crispy cottage cheese tossed in a savory ginger, garlic, and scallion sauce.',
        fullDescription: 'Fried golden cottage cheese cubes tossed in an aromatic dark savory glaze made with braised ginger, garlic, chopped coriander roots, green chilies, and light soy sauce.',
        price: 295,
        image: '/images/dishes/paneer-manchurian.jpg',
        isVeg: true,
        isSignature: false,
        spiceLevel: 2,
        preparationTime: '16 mins',
        ingredients: ['Cottage Cheese', 'Scallions', 'Braised Ginger', 'Light Soy', 'Green Chilies'],
        chefNote: 'Can be ordered dry as a starter or semi-gravy for pairing with rice.',
        available: true,
        displayOrder: 11,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'garlic-fried-rice',
        name: 'Burnt Garlic Fried Rice',
        slug: 'garlic-fried-rice',
        category: 'Chinese',
        description: 'Fragrant jasmine rice wok-tossed with aromatic golden burnt garlic and scallions.',
        fullDescription: 'Fluffy steamed rice wok-seared over high flame with crunchy golden burnt garlic flakes, finely diced spring vegetables, white pepper and toasted sesame oil.',
        price: 255,
        image: '/images/dishes/garlic-fried-rice.jpg',
        isVeg: true,
        isSignature: false,
        spiceLevel: 1,
        preparationTime: '15 mins',
        ingredients: ['Steamed Rice', 'Burnt Garlic Flakes', 'Scallions', 'White Pepper', 'Sesame Oil'],
        chefNote: 'Smoky wok aroma (wok hei) in every spoonful.',
        available: true,
        displayOrder: 12,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'paneer-fried-rice',
        name: 'Hestiia Paneer Fried Rice',
        slug: 'paneer-fried-rice',
        category: 'Chinese',
        description: 'Wok-tossed rice loaded with seasoned paneer cubes and crunchy vegetables.',
        fullDescription: 'Savory stir-fried rice loaded with lightly charred paneer cubes, sweet corn, carrots, French beans, and scallions in a light soy seasoning.',
        price: 285,
        image: '/images/dishes/paneer-fried-rice.jpg',
        isVeg: true,
        isSignature: false,
        spiceLevel: 1,
        preparationTime: '16 mins',
        ingredients: ['Rice', 'Seared Paneer Cubes', 'Sweet Corn', 'Carrots', 'Soy Seasoning'],
        chefNote: 'A wholesome meal enjoyed across all age groups.',
        available: true,
        displayOrder: 13,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'garlic-noodles',
        name: 'Chilli Garlic Hakka Noodles',
        slug: 'garlic-noodles',
        category: 'Noodles',
        description: 'Tossed noodles with a robust red chilli and roasted garlic punch.',
        fullDescription: 'Classic wheat noodles wok-tossed with julienne cabbage, bell peppers, scallions, fiery chili oil, and generous heaps of crushed roasted garlic.',
        price: 265,
        image: '/images/dishes/garlic-noodles.jpg',
        isVeg: true,
        isSignature: false,
        spiceLevel: 3,
        preparationTime: '15 mins',
        ingredients: ['Wheat Noodles', 'Roasted Garlic', 'Chili Oil', 'Julienne Peppers', 'Scallions'],
        chefNote: 'Bold, spicy, and satisfyingly zesty.',
        available: true,
        displayOrder: 14,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'hestiia-special-noodles',
        name: 'Hestiia Chef Special Noodles',
        slug: 'hestiia-special-noodles',
        category: 'Noodles',
        description: 'Signature wok-tossed noodles with paneer, exotic veggies and secret spice sauce.',
        fullDescription: 'Chef signature noodle preparation featuring yellow zucchini, baby corn, broccoli, shredded paneer and wok-smoked scallions in an exclusive five-spice sauce.',
        price: 295,
        image: '/images/dishes/hestiia-special-noodles.jpg',
        isVeg: true,
        isSignature: true,
        spiceLevel: 2,
        preparationTime: '18 mins',
        ingredients: ['Hand-Pulled Noodles', 'Paneer Ribbons', 'Broccoli', 'Baby Corn', 'Secret Five-Spice Sauce'],
        chefNote: 'Crafted exclusively by our executive chef for Hestiia guests.',
        available: true,
        displayOrder: 15,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'dum-aloo',
        name: 'Kashmiri Dum Aloo',
        slug: 'dum-aloo',
        category: 'Main Course',
        description: 'Baby potatoes simmered in a velvety Kashmiri chilli and fennel yogurt gravy.',
        fullDescription: 'Pricked baby potatoes deep-fried till golden, then slow-cooked under dough seal (dum) in an aromatic yogurt-based gravy flavored with Kashmiri deggi mirch, saunf (fennel) and dry ginger (sonth).',
        price: 285,
        image: '/images/dishes/dum-aloo.jpg',
        isVeg: true,
        isSignature: false,
        spiceLevel: 2,
        preparationTime: '22 mins',
        ingredients: ['Baby Potatoes', 'Kashmiri Chili Gravy', 'Fennel Powder', 'Dry Ginger', 'Hung Curd'],
        chefNote: 'Authentic recipe free of onion and garlic, bursting with rich warm spices.',
        available: true,
        displayOrder: 16,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
      },
    ];

    const initialPromotions: Promotion[] = [
      {
        id: 'promo-1',
        title: 'Royal Nawab Feast (Serves 4)',
        subtitle: 'Our signature multi-course grand dining experience',
        price: 1249,
        originalPrice: 1599,
        serves: '4 Guests',
        badge: 'Best Seller',
        items: [
          'Choice of Handi Paneer or Paneer Lababdar',
          'Choice of Hyderabadi Dum Biryani or Veg Biryani',
          'Dahi Ke Kebab Platter (6 pcs)',
          '4 Fresh Butter Naans & Laccha Parathas',
          'Chilled Gulab Jamun with Rose Rabdi (4 pcs)'
        ],
        image: '/images/dishes/paneer-lababdar.jpg',
        isActive: true,
        displayOrder: 1,
      },
      {
        id: 'promo-2',
        title: "Chef's Tasting Flight (Serves 2)",
        subtitle: 'Exclusive modern interpretations by our Master Chef',
        price: 1699,
        originalPrice: 1999,
        serves: '2 Guests',
        badge: 'Limited Edition',
        items: [
          'Welcome Smoked Chaas Shots',
          'Truffle Spiced Paneer 65 & Crispy Chilli Potato',
          'Handi Paneer in Mini Clay Pots with Warqi Parathas',
          'Slow Dum Chaap Tikka Biryani with Burani Raita',
          'Deconstructed Royal Rose Falooda with Gold Dust'
        ],
        image: '/images/dishes/handi-paneer.jpg',
        isActive: true,
        displayOrder: 2,
      },
    ];

    const initialGallery: GalleryPhoto[] = [
      {
        id: 'amb-1',
        title: 'The Golden Dining Sanctuary',
        category: 'Interior',
        image: '/images/ambience/ambience-1.jpg',
        description: 'Warm ambient pendant lights and plush velvet seating designed for unforgettable moments.',
        isFeatured: true,
        displayOrder: 1,
      },
      {
        id: 'amb-2',
        title: 'Intimate Leather Booths',
        category: 'Seating',
        image: '/images/ambience/ambience-2.jpg',
        description: 'Private partitioned dining alcoves with bespoke wood carvings and soft acoustic lighting.',
        isFeatured: true,
        displayOrder: 2,
      },
      {
        id: 'amb-3',
        title: 'The Artisanal Bar & Counter',
        category: 'Bar & Lounge',
        image: '/images/ambience/ambience-3.jpg',
        description: 'Backlit golden marble and brass counter crafting refreshing mocktails and smoked beverages.',
        isFeatured: true,
        displayOrder: 3,
      },
      {
        id: 'amb-4',
        title: 'Evening Candlelit Tables',
        category: 'Dining Table',
        image: '/images/ambience/ambience-4.jpg',
        description: 'Fine ceramic place settings with brass cutlery set against warm wooden tables.',
        isFeatured: false,
        displayOrder: 4,
      },
      {
        id: 'amb-5',
        title: 'Central Dining Hall',
        category: 'Main Hall',
        image: '/images/ambience/ambience-5.jpg',
        description: 'Spacious banquet-style dining hall with live indoor botanical accents and chandeliers.',
        isFeatured: false,
        displayOrder: 5,
      },
      {
        id: 'amb-6',
        title: 'Hestiia Exterior Facade',
        category: 'Facade',
        image: '/images/ambience/hestiia-facade.jpg',
        description: 'The illuminated golden entrance welcoming guests on PAC Road, Shyam Nagar, Kanpur.',
        isFeatured: true,
        displayOrder: 6,
      },
    ];

    const initialCustomers: Customer[] = [
      {
        id: 'cust_1',
        name: 'Aditya Srivastava',
        phone: '+91 98390 12345',
        email: 'aditya.srivastava@gmail.com',
        totalOrders: 3,
        totalSpent: 2840,
        lastOrderDate: '2026-10-24T19:30:00Z',
        createdAt: '2026-10-10T12:00:00Z',
      },
      {
        id: 'cust_2',
        name: 'Pooja Gupta',
        phone: '+91 94150 98765',
        email: 'pooja.gupta.knp@yahoo.com',
        totalOrders: 2,
        totalSpent: 1650,
        lastOrderDate: '2026-10-25T13:15:00Z',
        createdAt: '2026-10-15T15:30:00Z',
      },
      {
        id: 'cust_3',
        name: 'Vikram Rajput',
        phone: '+91 97920 44556',
        email: 'vikram.rajput@outlook.com',
        totalOrders: 1,
        totalSpent: 1311,
        lastOrderDate: '2026-10-25T13:45:00Z',
        createdAt: '2026-10-25T13:40:00Z',
      },
    ];

    const initialOrders: Order[] = [
      {
        id: 'ord_1001',
        orderNumber: 'HST-2026-1001',
        customerName: 'Aditya Srivastava',
        customerPhone: '+91 98390 12345',
        customerEmail: 'aditya.srivastava@gmail.com',
        deliveryAddress: 'Flat 402, Royal Enclave, Shyam Nagar, Kanpur',
        fulfillmentType: 'delivery',
        items: [
          { dishId: 'handi-paneer', name: 'Handi Paneer', price: 325, quantity: 2, total: 650, image: '/images/dishes/handi-paneer.jpg' },
          { dishId: 'veg-biryani', name: 'Veg Biryani', price: 344, quantity: 1, total: 344, image: '/images/dishes/veg-biryani.jpg' },
        ],
        subtotal: 994,
        taxAmount: 50,
        deliveryCharge: 40,
        discountAmount: 0,
        grandTotal: 1084,
        paymentMethod: 'online',
        paymentStatus: 'paid',
        orderStatus: 'completed',
        notes: 'Please keep extra coriander and green chutney.',
        statusHistory: [
          { status: 'pending', timestamp: '2026-10-24T19:30:00Z', actor: 'Customer' },
          { status: 'confirmed', timestamp: '2026-10-24T19:32:00Z', actor: 'Manager' },
          { status: 'preparing', timestamp: '2026-10-24T19:35:00Z', actor: 'Kitchen Head' },
          { status: 'out_for_delivery', timestamp: '2026-10-24T19:58:00Z', actor: 'Delivery Partner' },
          { status: 'completed', timestamp: '2026-10-24T20:25:00Z', actor: 'System' },
        ],
        invoiceNumber: 'HST-INV-1001',
        createdAt: '2026-10-24T19:30:00Z',
        updatedAt: '2026-10-24T20:25:00Z',
      },
      {
        id: 'ord_1002',
        orderNumber: 'HST-2026-1002',
        customerName: 'Pooja Gupta',
        customerPhone: '+91 94150 98765',
        customerEmail: 'pooja.gupta.knp@yahoo.com',
        deliveryAddress: 'Table #4 (Main Dining Hall)',
        fulfillmentType: 'dine-in',
        items: [
          { dishId: 'dahi-kebab', name: 'Dahi Ke Kebab', price: 315, quantity: 1, total: 315, image: '/images/dishes/dahi-kebab.jpg' },
          { dishId: 'paneer-lababdar', name: 'Paneer Lababdar', price: 365, quantity: 1, total: 365, image: '/images/dishes/paneer-lababdar.jpg' },
          { dishId: 'chaap-tikka-biryani', name: 'Chaap Tikka Biryani', price: 395, quantity: 1, total: 395, image: '/images/dishes/chaap-tikka-biryani.jpg' },
        ],
        subtotal: 1075,
        taxAmount: 54,
        deliveryCharge: 0,
        discountAmount: 0,
        grandTotal: 1129,
        paymentMethod: 'upi',
        paymentStatus: 'paid',
        orderStatus: 'preparing',
        notes: 'Mild spice for the child please.',
        statusHistory: [
          { status: 'pending', timestamp: '2026-10-25T13:15:00Z', actor: 'Customer' },
          { status: 'confirmed', timestamp: '2026-10-25T13:17:00Z', actor: 'Captain' },
          { status: 'preparing', timestamp: '2026-10-25T13:20:00Z', actor: 'Kitchen Head' },
        ],
        invoiceNumber: 'HST-INV-1002',
        createdAt: '2026-10-25T13:15:00Z',
        updatedAt: '2026-10-25T13:20:00Z',
      },
      {
        id: 'ord_1003',
        orderNumber: 'HST-2026-1003',
        customerName: 'Vikram Rajput',
        customerPhone: '+91 97920 44556',
        customerEmail: 'vikram.rajput@outlook.com',
        deliveryAddress: 'Self-Pickup Counter',
        fulfillmentType: 'pickup',
        items: [
          { dishId: 'royal-nawab-feast', name: 'Royal Nawab Feast (Serves 4)', price: 1249, quantity: 1, total: 1249, image: '/images/dishes/paneer-lababdar.jpg' },
        ],
        subtotal: 1249,
        taxAmount: 62,
        deliveryCharge: 0,
        discountAmount: 0,
        grandTotal: 1311,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        orderStatus: 'pending',
        notes: 'Will pick up at 08:30 PM sharp.',
        statusHistory: [
          { status: 'pending', timestamp: '2026-10-25T13:45:00Z', actor: 'Customer' },
        ],
        invoiceNumber: 'HST-INV-1003',
        createdAt: '2026-10-25T13:45:00Z',
        updatedAt: '2026-10-25T13:45:00Z',
      },
    ];

    const initialPayments: Payment[] = [
      {
        id: 'pay_1001',
        paymentReference: 'PAY_HST_1001',
        orderId: 'ord_1001',
        orderNumber: 'HST-2026-1001',
        amount: 1084,
        paymentMethod: 'online',
        paymentStatus: 'paid',
        transactionDate: '2026-10-24T19:31:15Z',
        gatewayTransactionReference: 'razor_pay_8918237192',
        gatewaySignature: 'sig_valid_verified_by_backend',
      },
      {
        id: 'pay_1002',
        paymentReference: 'PAY_HST_1002',
        orderId: 'ord_1002',
        orderNumber: 'HST-2026-1002',
        amount: 1129,
        paymentMethod: 'upi',
        paymentStatus: 'paid',
        transactionDate: '2026-10-25T13:16:30Z',
        gatewayTransactionReference: 'upi_ref_7880840622@okaxis',
        collectedBy: 'Floor Cashier 1',
      },
      {
        id: 'pay_1003',
        paymentReference: 'PAY_HST_1003',
        orderId: 'ord_1003',
        orderNumber: 'HST-2026-1003',
        amount: 1311,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        transactionDate: '2026-10-25T13:45:00Z',
      },
    ];

    const initialInvoices: Invoice[] = [
      {
        id: 'inv_1001',
        invoiceNumber: 'HST-INV-1001',
        orderId: 'ord_1001',
        orderNumber: 'HST-2026-1001',
        customerName: 'Aditya Srivastava',
        customerPhone: '+91 98390 12345',
        customerAddress: 'Flat 402, Royal Enclave, Shyam Nagar, Kanpur',
        items: initialOrders[0].items,
        subtotal: 994,
        taxAmount: 50,
        deliveryCharge: 40,
        discountAmount: 0,
        grandTotal: 1084,
        paymentMethod: 'Online Payment (Razorpay)',
        paymentStatus: 'Paid',
        issuedAt: '2026-10-24T19:30:00Z',
      },
      {
        id: 'inv_1002',
        invoiceNumber: 'HST-INV-1002',
        orderId: 'ord_1002',
        orderNumber: 'HST-2026-1002',
        customerName: 'Pooja Gupta',
        customerPhone: '+91 94150 98765',
        customerAddress: 'Table #4 (Main Dining Hall)',
        items: initialOrders[1].items,
        subtotal: 1075,
        taxAmount: 54,
        deliveryCharge: 0,
        discountAmount: 0,
        grandTotal: 1129,
        paymentMethod: 'UPI Dining Pay',
        paymentStatus: 'Paid',
        issuedAt: '2026-10-25T13:15:00Z',
      },
      {
        id: 'inv_1003',
        invoiceNumber: 'HST-INV-1003',
        orderId: 'ord_1003',
        orderNumber: 'HST-2026-1003',
        customerName: 'Vikram Rajput',
        customerPhone: '+91 97920 44556',
        customerAddress: 'Self-Pickup Counter',
        items: initialOrders[2].items,
        subtotal: 1249,
        taxAmount: 62,
        deliveryCharge: 0,
        discountAmount: 0,
        grandTotal: 1311,
        paymentMethod: 'Cash on Counter (COD)',
        paymentStatus: 'Pending',
        issuedAt: '2026-10-25T13:45:00Z',
      },
    ];

    const initialBookings: TableBooking[] = [
      {
        id: 'tb_2001',
        bookingRef: 'HST-TB-2610-2001',
        customerName: 'Rahul Verma',
        phone: '+91 98380 55667',
        email: 'rahul.verma@techcorp.in',
        date: '2026-10-26',
        time: '08:30 PM',
        guests: '4 Guests',
        occasion: 'Anniversary Dinner',
        specialRequests: 'Window side leather booth preferred with flower arrangement.',
        status: 'confirmed',
        allocatedTable: 'Booth B3',
        confirmedAt: '2026-10-24T16:30:00Z',
        confirmationMethod: 'whatsapp',
        holdPolicy: '15 minutes beyond reservation time',
        staffNotes: 'Allocated Booth B3. Captain informed for celebration dessert.',
        createdAt: '2026-10-24T15:00:00Z',
        updatedAt: '2026-10-24T16:30:00Z',
      },
      {
        id: 'tb_2002',
        bookingRef: 'HST-TB-2610-2002',
        customerName: 'Neha Awasthi',
        phone: '+91 99180 33441',
        email: 'neha.awasthi@gmail.com',
        date: '2026-10-27',
        time: '01:30 PM',
        guests: '6 Guests',
        occasion: 'Family Lunch Gathering',
        specialRequests: 'One high chair for toddler required.',
        status: 'new',
        holdPolicy: '15 minutes beyond reservation time',
        staffNotes: '',
        createdAt: '2026-10-25T10:15:00Z',
        updatedAt: '2026-10-25T10:15:00Z',
      },
    ];

    const initialPartyInquiries: PartyInquiry[] = [
      {
        id: 'pty_3001',
        customerName: 'Dr. Alok Nath Dixit',
        phone: '+91 94151 22334',
        email: 'dr.alok.dixit@kanpurmed.org',
        eventType: 'birthday',
        preferredDate: '2026-11-08',
        guestCount: 35,
        budgetRange: '₹35,000 – ₹50,000',
        specialRequirements: 'Private banquet section, live starter buffet with Dahi Ke Kebab and Handi Paneer live counter.',
        status: 'contacted',
        staffNotes: 'Called Dr. Dixit. Sent custom banquet menu on WhatsApp. Waiting for menu finalization.',
        followUpDate: '2026-10-28',
        createdAt: '2026-10-23T11:20:00Z',
        updatedAt: '2026-10-24T09:40:00Z',
      },
      {
        id: 'pty_3002',
        customerName: 'Ritu Singhania',
        phone: '+91 98399 77880',
        email: 'ritu.singhania@elegance.com',
        eventType: 'corporate',
        preferredDate: '2026-11-15',
        guestCount: 50,
        budgetRange: '₹50,000 – ₹75,000',
        specialRequirements: 'High-tea followed by multi-course North Indian dinner. Projector and mic setup needed.',
        status: 'new',
        staffNotes: '',
        followUpDate: '2026-10-26',
        createdAt: '2026-10-25T12:00:00Z',
        updatedAt: '2026-10-25T12:00:00Z',
      },
    ];

    const initialReviews: ReviewItem[] = [
      {
        id: 'rev_1',
        customerName: 'Akash Mehrotra',
        rating: 5,
        dishName: 'Handi Paneer',
        comment: 'Hands down the best Handi Paneer in Kanpur! The slow clay pot smoke flavour is unforgettable. Warm hospitality and stunning interiors.',
        source: 'google',
        isApproved: true,
        staffReply: 'Thank you Akash ji! It is an honour to serve you our master chef clay handi preparation. Looking forward to welcoming you back!',
        createdAt: '2026-10-20T14:00:00Z',
      },
      {
        id: 'rev_2',
        customerName: 'Shalini Tripathi',
        rating: 5,
        dishName: 'Dahi Ke Kebab',
        comment: 'The Dahi Ke Kebab literally melted in mouth. Perfect ambience for family celebrations. Clean, lavish, and courteous team.',
        source: 'website',
        isApproved: true,
        staffReply: 'Warm gratitude Shalini ji! Our kitchen team pours love into our signature hung curd kebabs.',
        createdAt: '2026-10-22T21:10:00Z',
      },
      {
        id: 'rev_3',
        customerName: 'Manish Chawla',
        rating: 4,
        dishName: 'Hyderabadi Dum Biryani',
        comment: 'Very authentic dum aroma and authentic long-grain basmati rice. Slight delay on weekend peak hours, but food quality is unmatched.',
        source: 'direct',
        isApproved: true,
        staffReply: 'Thank you for your valuable feedback Manish ji. We have reinforced our weekend kitchen line to reduce wait times.',
        createdAt: '2026-10-24T20:30:00Z',
      },
    ];

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
