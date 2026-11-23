import { analyticsRepository } from '../repositories/analytics.repository.js';
import { DateFilterQuery, RevenueAnalytics, RevenueTrendPoint } from '../types/analytics.types.js';
import { formatDateBucket, parseDateFilter } from '../utils/date-filter.util.js';

export const analyticsRevenueService = {
  /**
   * Financial performance and revenue analytics with period comparison
   */
  async getRevenueAnalytics(query: DateFilterQuery): Promise<{ dateRange: any; revenue: RevenueAnalytics }> {
    const dateRange = parseDateFilter(query);

    // Fetch current and previous periods concurrently
    const [currentOrders, currentPayments, previousOrders, previousPayments] = await Promise.all([
      analyticsRepository.getOrdersInRange({
        startDateIso: dateRange.startDateIso,
        endDateIso: dateRange.endDateIso,
      }),
      analyticsRepository.getPaymentsInRange({
        startDateIso: dateRange.startDateIso,
        endDateIso: dateRange.endDateIso,
      }),
      analyticsRepository.getOrdersInRange({
        startDateIso: dateRange.previousStartDateIso,
        endDateIso: dateRange.previousEndDateIso,
      }),
      analyticsRepository.getPaymentsInRange({
        startDateIso: dateRange.previousStartDateIso,
        endDateIso: dateRange.previousEndDateIso,
      }),
    ]);

    // Current period metrics
    let grossSalesPaise = 0;
    let discountsPaise = 0;
    let netSalesPaise = 0;
    let validOrdersCount = 0;

    const trendBuckets = new Map<string, RevenueTrendPoint>();

    currentOrders.forEach((o) => {
      if (o.orderStatus !== 'cancelled') {
        validOrdersCount++;
        const subPaise = o.subtotalInPaise ?? Math.round(o.subtotal * 100);
        const discPaise = o.discountInPaise ?? Math.round((o.discountAmount || 0) * 100);
        const grandPaise = o.grandTotalInPaise ?? Math.round(o.grandTotal * 100);

        grossSalesPaise += subPaise;
        discountsPaise += discPaise;
        netSalesPaise += grandPaise;

        const bucketKey = formatDateBucket(o.createdAt, dateRange.groupBy);
        const bucket = trendBuckets.get(bucketKey) || {
          date: bucketKey,
          grossSales: 0,
          grossSalesInPaise: 0,
          discounts: 0,
          discountsInPaise: 0,
          netSales: 0,
          netSalesInPaise: 0,
          collectedRevenue: 0,
          collectedRevenueInPaise: 0,
          refunds: 0,
          refundsInPaise: 0,
          orderCount: 0,
        };

        bucket.grossSalesInPaise += subPaise;
        bucket.discountsInPaise += discPaise;
        bucket.netSalesInPaise += grandPaise;
        bucket.orderCount += 1;
        trendBuckets.set(bucketKey, bucket);
      }
    });

    let collectedRevenuePaise = 0;
    let refundAmountsPaise = 0;

    currentPayments.forEach((p) => {
      const bucketKey = formatDateBucket(p.transactionDate, dateRange.groupBy);
      const bucket = trendBuckets.get(bucketKey) || {
        date: bucketKey,
        grossSales: 0,
        grossSalesInPaise: 0,
        discounts: 0,
        discountsInPaise: 0,
        netSales: 0,
        netSalesInPaise: 0,
        collectedRevenue: 0,
        collectedRevenueInPaise: 0,
        refunds: 0,
        refundsInPaise: 0,
        orderCount: 0,
      };

      if (p.paymentStatus === 'paid') {
        const amtPaise = p.amountInPaise ?? Math.round(p.amount * 100);
        collectedRevenuePaise += amtPaise;
        bucket.collectedRevenueInPaise += amtPaise;
      } else if (p.paymentStatus === 'refunded') {
        const refPaise = p.refundAmount ? Math.round(p.refundAmount * 100) : (p.amountInPaise ?? Math.round(p.amount * 100));
        refundAmountsPaise += refPaise;
        bucket.refundsInPaise += refPaise;
      }
      trendBuckets.set(bucketKey, bucket);
    });

    // Populate rupee floats on trend points and sort chronologically
    const trends: RevenueTrendPoint[] = Array.from(trendBuckets.values())
      .map((b) => ({
        ...b,
        grossSales: b.grossSalesInPaise / 100,
        discounts: b.discountsInPaise / 100,
        netSales: b.netSalesInPaise / 100,
        collectedRevenue: b.collectedRevenueInPaise / 100,
        refunds: b.refundsInPaise / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Previous period metrics for comparison
    let prevNetSalesPaise = 0;
    previousOrders.forEach((o) => {
      if (o.orderStatus !== 'cancelled') {
        prevNetSalesPaise += o.grandTotalInPaise ?? Math.round(o.grandTotal * 100);
      }
    });

    let prevCollectedRevenuePaise = 0;
    previousPayments.forEach((p) => {
      if (p.paymentStatus === 'paid') {
        prevCollectedRevenuePaise += p.amountInPaise ?? Math.round(p.amount * 100);
      }
    });

    const calculatePercentChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 1000) / 10;
    };

    const aovPaise = validOrdersCount > 0 ? Math.round(netSalesPaise / validOrdersCount) : 0;

    const revenue: RevenueAnalytics = {
      grossSales: grossSalesPaise / 100,
      grossSalesInPaise: grossSalesPaise,
      discounts: discountsPaise / 100,
      discountsInPaise: discountsPaise,
      netSales: netSalesPaise / 100,
      netSalesInPaise: netSalesPaise,
      collectedRevenue: collectedRevenuePaise / 100,
      collectedRevenueInPaise: collectedRevenuePaise,
      refundAmounts: refundAmountsPaise / 100,
      refundAmountsInPaise: refundAmountsPaise,
      averageOrderValue: aovPaise / 100,
      averageOrderValueInPaise: aovPaise,
      comparison: {
        previousCollectedRevenue: prevCollectedRevenuePaise / 100,
        revenueChangePercent: calculatePercentChange(collectedRevenuePaise, prevCollectedRevenuePaise),
        previousNetSales: prevNetSalesPaise / 100,
        netSalesChangePercent: calculatePercentChange(netSalesPaise, prevNetSalesPaise),
        previousTotalOrders: previousOrders.length,
        ordersChangePercent: calculatePercentChange(currentOrders.length, previousOrders.length),
      },
      trends,
    };

    return {
      dateRange: {
        preset: dateRange.preset,
        groupBy: dateRange.groupBy,
        startDate: dateRange.startDateIso,
        endDate: dateRange.endDateIso,
        previousStartDate: dateRange.previousStartDateIso,
        previousEndDate: dateRange.previousEndDateIso,
      },
      revenue,
    };
  },
};
