import { analyticsRepository } from '../repositories/analytics.repository.js';
import { DateFilterQuery, OrderAnalytics } from '../types/analytics.types.js';
import { formatDateBucket, parseDateFilter } from '../utils/date-filter.util.js';

export const analyticsOrdersService = {
  /**
   * Order performance reporting and peak pattern analysis
   */
  async getOrderAnalytics(query: DateFilterQuery): Promise<{ dateRange: any; orders: OrderAnalytics }> {
    const dateRange = parseDateFilter(query);

    const orders = await analyticsRepository.getOrdersInRange({
      startDateIso: dateRange.startDateIso,
      endDateIso: dateRange.endDateIso,
    });

    const totalOrders = orders.length;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let pendingOrders = 0;

    const ordersByStatus: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      ready_for_pickup: 0,
      out_for_delivery: 0,
      completed: 0,
      cancelled: 0,
    };

    const ordersByType = {
      delivery: 0,
      pickup: 0,
      dineIn: 0,
    };

    // Hour distribution in restaurant timezone (Asia/Kolkata +5:30)
    const hourCounts = new Array(24).fill(0);
    const trendMap = new Map<string, { date: string; totalOrders: number; completedOrders: number; cancelledOrders: number }>();

    let totalValidSalesPaise = 0;
    let validOrdersCount = 0;

    // Track preparation durations for valid completed/ready orders
    const prepDurationsMinutes: number[] = [];

    orders.forEach((o) => {
      // Status breakdown
      const st = o.orderStatus || 'pending';
      ordersByStatus[st] = (ordersByStatus[st] || 0) + 1;

      if (st === 'completed') completedOrders++;
      else if (st === 'cancelled') cancelledOrders++;
      else if (st === 'pending') pendingOrders++;

      // Fulfillment breakdown
      if (o.fulfillmentType === 'delivery') ordersByType.delivery++;
      else if (o.fulfillmentType === 'pickup') ordersByType.pickup++;
      else if (o.fulfillmentType === 'dine-in') ordersByType.dineIn++;

      // Financial for valid orders
      if (st !== 'cancelled') {
        validOrdersCount++;
        totalValidSalesPaise += o.grandTotalInPaise ?? Math.round(o.grandTotal * 100);
      }

      // Peak hour calculation (Asia/Kolkata UTC+5.5)
      const createdAtDate = new Date(o.createdAt);
      if (!isNaN(createdAtDate.getTime())) {
        const utcHours = createdAtDate.getUTCHours();
        const utcMinutes = createdAtDate.getUTCMinutes();
        const istHour = Math.floor((utcHours + (utcMinutes + 30) / 60 + 5) % 24);
        hourCounts[istHour]++;
      }

      // Trends bucket
      const bucketKey = formatDateBucket(o.createdAt, dateRange.groupBy);
      const trend = trendMap.get(bucketKey) || {
        date: bucketKey,
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
      };
      trend.totalOrders++;
      if (st === 'completed') trend.completedOrders++;
      if (st === 'cancelled') trend.cancelledOrders++;
      trendMap.set(bucketKey, trend);

      // Average prep time from status history
      if (Array.isArray(o.statusHistory) && o.statusHistory.length >= 2) {
        const prepEntry = o.statusHistory.find((h: any) => h.status === 'preparing');
        const readyEntry = o.statusHistory.find((h: any) => h.status === 'ready_for_pickup' || h.status === 'completed');

        if (prepEntry && readyEntry) {
          const prepStart = new Date(prepEntry.timestamp).getTime();
          const prepEnd = new Date(readyEntry.timestamp).getTime();
          if (prepEnd > prepStart) {
            const durationMin = Math.round((prepEnd - prepStart) / 60000);
            if (durationMin > 0 && durationMin < 300) {
              prepDurationsMinutes.push(durationMin);
            }
          }
        }
      }
    });

    // Format peak ordering hours
    const peakOrderingHours = hourCounts.map((count, hour) => {
      const displayHour = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
      return {
        hour,
        formattedHour: displayHour,
        orderCount: count,
        percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 1000) / 10 : 0,
      };
    });

    const trends = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    const aovPaise = validOrdersCount > 0 ? Math.round(totalValidSalesPaise / validOrdersCount) : 0;
    const averagePreparationTimeMinutes =
      prepDurationsMinutes.length > 0
        ? Math.round((prepDurationsMinutes.reduce((sum, d) => sum + d, 0) / prepDurationsMinutes.length) * 10) / 10
        : null;

    const orderAnalytics: OrderAnalytics = {
      totalOrders,
      completedOrders,
      cancelledOrders,
      pendingOrders,
      ordersByStatus,
      ordersByType,
      peakOrderingHours,
      trends,
      averageOrderValue: aovPaise / 100,
      averageOrderValueInPaise: aovPaise,
      averagePreparationTimeMinutes,
    };

    return {
      dateRange: {
        preset: dateRange.preset,
        groupBy: dateRange.groupBy,
        startDate: dateRange.startDateIso,
        endDate: dateRange.endDateIso,
      },
      orders: orderAnalytics,
    };
  },
};
