import { db } from '../../../shared/config/db.js';
import { analyticsRepository } from '../repositories/analytics.repository.js';
import { CustomerAnalytics, DateFilterQuery } from '../types/analytics.types.js';
import { parseDateFilter } from '../utils/date-filter.util.js';

export const analyticsCustomersService = {
  /**
   * Customer acquisition, retention, and lifetime value analytics
   */
  async getCustomerAnalytics(query: DateFilterQuery): Promise<{ dateRange: any; customers: CustomerAnalytics }> {
    const dateRange = parseDateFilter(query);

    // 1. Fetch period orders
    const periodOrders = await analyticsRepository.getOrdersInRange({
      startDateIso: dateRange.startDateIso,
      endDateIso: dateRange.endDateIso,
    });

    // 2. Fetch all lifetime non-cancelled orders to accurately determine new vs returning
    const allOrders = db.getState().orders || [];
    const lifetimeCustomerHistory = new Map<
      string,
      { firstOrderDate: string; totalLifetimeOrders: number; totalLifetimeSpendPaise: number; name: string }
    >();

    allOrders.forEach((o) => {
      if (o.orderStatus !== 'cancelled' && o.customerPhone) {
        const phone = o.customerPhone.trim();
        const grandPaise = o.grandTotalInPaise ?? Math.round(o.grandTotal * 100);
        const existing = lifetimeCustomerHistory.get(phone);

        if (!existing) {
          lifetimeCustomerHistory.set(phone, {
            firstOrderDate: o.createdAt,
            totalLifetimeOrders: 1,
            totalLifetimeSpendPaise: grandPaise,
            name: o.customerName || 'Customer',
          });
        } else {
          existing.totalLifetimeOrders += 1;
          existing.totalLifetimeSpendPaise += grandPaise;
          if (o.createdAt < existing.firstOrderDate) {
            existing.firstOrderDate = o.createdAt;
          }
          if (o.customerName && existing.name === 'Customer') {
            existing.name = o.customerName;
          }
        }
      }
    });

    // 3. Process period customers
    const periodCustomerSpend = new Map<
      string,
      { phone: string; name: string; periodOrders: number; periodSpendPaise: number; lastOrderDate: string }
    >();

    periodOrders.forEach((o) => {
      if (o.orderStatus !== 'cancelled' && o.customerPhone) {
        const phone = o.customerPhone.trim();
        const grandPaise = o.grandTotalInPaise ?? Math.round(o.grandTotal * 100);
        const current = periodCustomerSpend.get(phone) || {
          phone,
          name: o.customerName || 'Customer',
          periodOrders: 0,
          periodSpendPaise: 0,
          lastOrderDate: o.createdAt,
        };

        current.periodOrders += 1;
        current.periodSpendPaise += grandPaise;
        if (o.createdAt > current.lastOrderDate) {
          current.lastOrderDate = o.createdAt;
        }
        periodCustomerSpend.set(phone, current);
      }
    });

    const totalUniqueCustomers = periodCustomerSpend.size;
    let newCustomers = 0;
    let returningCustomers = 0;
    let totalPeriodSpendPaise = 0;
    let totalPeriodOrders = 0;

    const frequencyBuckets = {
      oneTime: 0,
      twoToFive: 0,
      sixPlus: 0,
    };

    periodCustomerSpend.forEach((data, phone) => {
      totalPeriodSpendPaise += data.periodSpendPaise;
      totalPeriodOrders += data.periodOrders;

      const lifetime = lifetimeCustomerHistory.get(phone);
      if (lifetime && lifetime.firstOrderDate >= dateRange.startDateIso) {
        newCustomers++;
      } else {
        returningCustomers++;
      }

      // Grouping based on lifetime order volume
      const orderCount = lifetime?.totalLifetimeOrders ?? data.periodOrders;
      if (orderCount === 1) frequencyBuckets.oneTime++;
      else if (orderCount <= 5) frequencyBuckets.twoToFive++;
      else frequencyBuckets.sixPlus++;
    });

    const repeatPurchaseRate =
      totalUniqueCustomers > 0 ? Math.round((returningCustomers / totalUniqueCustomers) * 1000) / 10 : 0;

    const averageOrdersPerCustomer =
      totalUniqueCustomers > 0 ? Math.round((totalPeriodOrders / totalUniqueCustomers) * 10) / 10 : 0;

    const avgSpendPaise = totalUniqueCustomers > 0 ? Math.round(totalPeriodSpendPaise / totalUniqueCustomers) : 0;

    // Highest value customers
    const highestValueCustomers = Array.from(periodCustomerSpend.values())
      .sort((a, b) => b.periodSpendPaise - a.periodSpendPaise)
      .slice(0, 10)
      .map((c) => ({
        phone: c.phone,
        name: c.name,
        totalOrders: c.periodOrders,
        totalSpent: c.periodSpendPaise / 100,
        totalSpentInPaise: c.periodSpendPaise,
        lastOrderDate: c.lastOrderDate,
      }));

    const customers: CustomerAnalytics = {
      totalUniqueCustomers,
      newCustomers,
      returningCustomers,
      repeatPurchaseRate,
      averageOrdersPerCustomer,
      averageCustomerSpending: avgSpendPaise / 100,
      averageCustomerSpendingInPaise: avgSpendPaise,
      highestValueCustomers,
      orderingFrequency: frequencyBuckets,
    };

    return {
      dateRange: {
        preset: dateRange.preset,
        startDate: dateRange.startDateIso,
        endDate: dateRange.endDateIso,
      },
      customers,
    };
  },
};
