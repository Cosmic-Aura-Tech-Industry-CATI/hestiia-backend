import { analyticsRepository } from '../repositories/analytics.repository.js';
import { DateFilterQuery, OverviewMetrics } from '../types/analytics.types.js';
import { parseDateFilter } from '../utils/date-filter.util.js';

export const analyticsOverviewService = {
  /**
   * Consolidated overview metrics for Admin Dashboard
   */
  async getOverviewMetrics(query: DateFilterQuery): Promise<{ dateRange: any; metrics: OverviewMetrics }> {
    const dateRange = parseDateFilter(query);

    const [orders, payments, lifetimeCounts] = await Promise.all([
      analyticsRepository.getOrdersInRange({
        startDateIso: dateRange.startDateIso,
        endDateIso: dateRange.endDateIso,
      }),
      analyticsRepository.getPaymentsInRange({
        startDateIso: dateRange.startDateIso,
        endDateIso: dateRange.endDateIso,
      }),
      analyticsRepository.getLifetimeCustomerOrderCounts(),
    ]);

    // Order counts by status
    const totalOrders = orders.length;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let pendingOrders = 0;

    // Financial accumulations (integer paise precision)
    let totalSalesPaise = 0;
    const dishSalesMap = new Map<string, { name: string; quantity: number; revenuePaise: number }>();
    const uniquePhonesInPeriod = new Set<string>();

    orders.forEach((o) => {
      if (o.orderStatus === 'completed') completedOrders++;
      else if (o.orderStatus === 'cancelled') cancelledOrders++;
      else if (o.orderStatus === 'pending') pendingOrders++;

      if (o.customerPhone) uniquePhonesInPeriod.add(o.customerPhone);

      // Only count valid (non-cancelled) orders for sales and item performance
      if (o.orderStatus !== 'cancelled') {
        const orderGrandTotalPaise = o.grandTotalInPaise ?? Math.round(o.grandTotal * 100);
        totalSalesPaise += orderGrandTotalPaise;

        if (Array.isArray(o.items)) {
          o.items.forEach((item: any) => {
            const key = item.dishId || item.name;
            const itemRevPaise = item.totalInPaise ?? Math.round(item.total * 100);
            const current = dishSalesMap.get(key) || { name: item.name, quantity: 0, revenuePaise: 0 };
            current.quantity += item.quantity || 1;
            current.revenuePaise += itemRevPaise;
            dishSalesMap.set(key, current);
          });
        }
      }
    });

    // Payment accumulations (verified records only)
    let collectedRevenuePaise = 0;
    let totalRefundsPaise = 0;

    payments.forEach((p) => {
      if (p.paymentStatus === 'paid') {
        const amtPaise = p.amountInPaise ?? Math.round(p.amount * 100);
        collectedRevenuePaise += amtPaise;
      } else if (p.paymentStatus === 'refunded') {
        const refPaise = p.refundAmount ? Math.round(p.refundAmount * 100) : (p.amountInPaise ?? Math.round(p.amount * 100));
        totalRefundsPaise += refPaise;
      }
    });

    // Customer categorization: unique & returning
    const uniqueCustomers = uniquePhonesInPeriod.size;
    let returningCustomers = 0;
    uniquePhonesInPeriod.forEach((phone) => {
      const lifetimeOrders = lifetimeCounts.get(phone) || 0;
      if (lifetimeOrders > 1) {
        returningCustomers++;
      }
    });

    // Best-selling product by quantity sold
    let bestSellingProduct: OverviewMetrics['bestSellingProduct'] = null;
    let maxQuantity = 0;

    dishSalesMap.forEach((val, dishId) => {
      if (val.quantity > maxQuantity) {
        maxQuantity = val.quantity;
        bestSellingProduct = {
          dishId,
          name: val.name,
          quantitySold: val.quantity,
          revenue: val.revenuePaise / 100,
          revenueInPaise: val.revenuePaise,
        };
      }
    });

    // Average order value
    const nonCancelledCount = totalOrders - cancelledOrders;
    const aovPaise = nonCancelledCount > 0 ? Math.round(totalSalesPaise / nonCancelledCount) : 0;

    const metrics: OverviewMetrics = {
      totalOrders,
      completedOrders,
      cancelledOrders,
      pendingOrders,
      totalSales: totalSalesPaise / 100,
      totalSalesInPaise: totalSalesPaise,
      collectedRevenue: collectedRevenuePaise / 100,
      collectedRevenueInPaise: collectedRevenuePaise,
      totalRefunds: totalRefundsPaise / 100,
      totalRefundsInPaise: totalRefundsPaise,
      averageOrderValue: aovPaise / 100,
      averageOrderValueInPaise: aovPaise,
      uniqueCustomers,
      returningCustomers,
      bestSellingProduct,
    };

    return {
      dateRange: {
        preset: dateRange.preset,
        startDate: dateRange.startDateIso,
        endDate: dateRange.endDateIso,
      },
      metrics,
    };
  },
};
