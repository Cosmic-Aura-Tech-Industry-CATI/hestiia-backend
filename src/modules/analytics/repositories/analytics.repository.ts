import mongoose from 'mongoose';
import { db, Order as OrderModel, Payment as PaymentModel, Customer as CustomerModel } from '../../../shared/config/db.js';
import type { Order, Payment, Customer } from '../../../shared/config/store.js';

export interface DateFilterBoundaries {
  startDateIso: string;
  endDateIso: string;
}

export class AnalyticsRepository {
  /**
   * Fetch orders within date range (inclusive)
   */
  async getOrdersInRange(boundaries: DateFilterBoundaries): Promise<Order[]> {
    const { startDateIso, endDateIso } = boundaries;

    if (mongoose.connection.readyState === 1) {
      try {
        const orderModel = mongoose.models.Order;
        if (orderModel) {
          const start = new Date(startDateIso);
          const end = new Date(endDateIso.includes('T') ? endDateIso : `${endDateIso}T23:59:59.999Z`);
          return await orderModel
            .find({
              createdAt: { $gte: start, $lte: end },
            })
            .lean();
        }
      } catch {
        // Fall back to local store
      }
    }

    const state = db.getState();
    return state.orders.filter(
      (o) => o.createdAt >= startDateIso && o.createdAt <= endDateIso
    );
  }

  /**
   * Fetch payments within date range (inclusive)
   */
  async getPaymentsInRange(boundaries: DateFilterBoundaries): Promise<Payment[]> {
    const { startDateIso, endDateIso } = boundaries;

    if (mongoose.connection.readyState === 1) {
      try {
        const paymentModel = mongoose.models.Payment;
        if (paymentModel) {
          const start = new Date(startDateIso);
          const end = new Date(endDateIso.includes('T') ? endDateIso : `${endDateIso}T23:59:59.999Z`);
          return await paymentModel
            .find({
              transactionDate: { $gte: start, $lte: end },
            })
            .lean();
        }
      } catch {
        // Fall back to local store
      }
    }

    const state = db.getState();
    return state.payments.filter(
      (p) => p.transactionDate >= startDateIso && p.transactionDate <= endDateIso
    );
  }

  /**
   * Fetch all registered customers
   */
  async getAllCustomers(): Promise<Customer[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const customerModel = mongoose.models.Customer;
        if (customerModel) {
          return await customerModel
            .find()
            .select('name phone email totalSpent totalOrders lastOrderDate createdAt')
            .lean();
        }
      } catch {
        // Fall back to local store
      }
    }

    return db.getState().customers || [];
  }

  /**
   * Compute lifetime order count per customer phone across entire order history
   */
  async getLifetimeCustomerOrderCounts(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    if (mongoose.connection.readyState === 1) {
      try {
        const orderModel = mongoose.models.Order;
        if (orderModel) {
          const results = await orderModel.aggregate([
            { $match: { orderStatus: { $ne: 'cancelled' } } },
            { $group: { _id: '$customerPhone', count: { $sum: 1 } } },
          ]);
          results.forEach((r: any) => {
            if (r._id) counts.set(String(r._id), r.count);
          });
          return counts;
        }
      } catch {
        // Fall back to local store
      }
    }

    const allOrders = db.getState().orders || [];
    allOrders.forEach((o) => {
      if (o.orderStatus !== 'cancelled' && o.customerPhone) {
        counts.set(o.customerPhone, (counts.get(o.customerPhone) || 0) + 1);
      }
    });

    return counts;
  }
}

export const analyticsRepository = new AnalyticsRepository();
