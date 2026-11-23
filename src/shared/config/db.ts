import mongoose from 'mongoose';
import { MONGODB_URI } from './utils.js';
import { db } from './store.js';

// Export Mongoose Models for direct Atlas operations
export { Payment, type IPaymentDocument } from '../../modules/payments/payment.model.js';
export { Invoice, type IInvoiceDocument } from '../../modules/invoices/invoice.model.js';
export { Promotion, type IPromotionDocument } from '../../modules/promotions/promotion.model.js';
export { Review, type IReviewDocument } from '../../modules/reviews/review.model.js';
export { Table, type ITableDocument } from '../../modules/tables/table.model.js';
export { Setting, type ISettingDocument } from '../../modules/settings/setting.model.js';
export { Conversation, type IConversationDocument } from '../../modules/conversations/conversation.model.js';
export { AuditLog, type IAuditLogDocument } from '../../modules/audit/audit.model.js';
export { Counter, type ICounter } from '../../modules/orders/counter.model.js';
export { Order, type IOrderDocument } from '../../modules/orders/order.model.js';
export { MenuItem, type IFoodItemDocument } from '../../modules/menu/menu.model.js';
export { Customer, type ICustomerDocument } from '../../modules/customers/customer.model.js';
export { User, type IUserDocument } from '../../modules/users/user.model.js';
export { Booking, type IBookingDocument } from '../../modules/bookings/booking.model.js';
export { PartyInquiry, type IPartyInquiryDocument } from '../../modules/party/party.model.js';
export { Cart, type ICartDocument } from '../../modules/cart/cart.model.js';
export { Contact, type IContactDocument } from '../../modules/contact/contact.model.js';
export { DeliveryAssignment, type IDeliveryAssignmentDocument } from '../../modules/delivery/delivery.model.js';
export {
  LoyaltyAccount,
  type ILoyaltyAccountDocument,
  LoyaltyTransaction,
  type ILoyaltyTransactionDocument,
} from '../../modules/loyalty/loyalty.model.js';
export { Offer, type IOfferDocument } from '../../modules/offers/offer.model.js';
export { PricingRule, type IPricingRuleDocument } from '../../modules/pricing/pricing.model.js';

let isConnected = false;

export async function connectDB(): Promise<boolean> {
  if (!MONGODB_URI) {
    console.log('[Database] No MONGODB_URI configured. Running in persistent local store mode.');
    return false;
  }

  if (isConnected && mongoose.connection.readyState === 1) {
    return true;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 50,
      minPoolSize: 10,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      w: 'majority',
      autoIndex: process.env.NODE_ENV !== 'production',
    });

    isConnected = true;
    console.log(`[Database] Live connection established to MongoDB Atlas: ${mongoose.connection.host}`);
    return true;
  } catch (err: any) {
    console.warn(`[Database] MongoDB connection bypassed (${err?.message || 'Host unreachable'}). Operating on high-performance local database.`);
    return false;
  }
}

export { db };
export * from './store.js';
export default connectDB;
