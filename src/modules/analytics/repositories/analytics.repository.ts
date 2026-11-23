import mongoose from 'mongoose';
import { db, Order, Payment, Customer } from '../../../shared/config/db.js';

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
          return await orderModel
            .find({
              createdAt: { $gte: startDateIso, $lte: endDateIso },
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
          return await paymentModel
            .find({
              transactionDate: { $gte: startDateIso, $lte: endDateIso },
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
          return await customerModel.find().lean();
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
