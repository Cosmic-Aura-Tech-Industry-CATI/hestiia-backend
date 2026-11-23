import { analyticsRepository } from '../repositories/analytics.repository.js';
import { DateFilterQuery, PaymentAnalytics } from '../types/analytics.types.js';
import { formatDateBucket, parseDateFilter } from '../utils/date-filter.util.js';

export const analyticsPaymentsService = {
  /**
   * Payment transactions, gateway metrics, and reconciliation reporting
   */
  async getPaymentAnalytics(query: DateFilterQuery): Promise<{ dateRange: any; payments: PaymentAnalytics }> {
    const dateRange = parseDateFilter(query);

    const payments = await analyticsRepository.getPaymentsInRange({
      startDateIso: dateRange.startDateIso,
      endDateIso: dateRange.endDateIso,
    });

    const totalPaymentAttempts = payments.length;
    let successfulPayments = 0;
    let failedPayments = 0;
    let pendingPayments = 0;
    let cancelledOrRefundedPayments = 0;

    const paymentMethodDistribution = {
      online: 0,
      upi: 0,
      cod: 0,
    };

    let totalCapturedPaise = 0;
    let totalRefundedPaise = 0;
    let refundCount = 0;

    const trendMap = new Map<
      string,
      { date: string; capturedAmountPaise: number; refundsPaise: number; transactionCount: number }
    >();

    payments.forEach((p) => {
      // Payment method breakdown
      if (p.paymentMethod === 'online') paymentMethodDistribution.online++;
      else if (p.paymentMethod === 'upi') paymentMethodDistribution.upi++;
      else if (p.paymentMethod === 'cod') paymentMethodDistribution.cod++;

      const bucketKey = formatDateBucket(p.transactionDate, dateRange.groupBy);
      const trend = trendMap.get(bucketKey) || {
        date: bucketKey,
        capturedAmountPaise: 0,
        refundsPaise: 0,
        transactionCount: 0,
      };
      trend.transactionCount++;

      // Status aggregation
      if (p.paymentStatus === 'paid') {
        successfulPayments++;
        const amtPaise = p.amountInPaise ?? Math.round(p.amount * 100);
        totalCapturedPaise += amtPaise;
        trend.capturedAmountPaise += amtPaise;
      } else if (p.paymentStatus === 'failed') {
        failedPayments++;
      } else if (p.paymentStatus === 'refunded') {
        cancelledOrRefundedPayments++;
        refundCount++;
        const refPaise = p.refundAmount ? Math.round(p.refundAmount * 100) : (p.amountInPaise ?? Math.round(p.amount * 100));
        totalRefundedPaise += refPaise;
        trend.refundsPaise += refPaise;
      } else {
        pendingPayments++;
      }

      trendMap.set(bucketKey, trend);
    });

    const paymentSuccessRate =
      totalPaymentAttempts > 0 ? Math.round((successfulPayments / totalPaymentAttempts) * 1000) / 10 : 0;

    const trends = Array.from(trendMap.values())
      .map((t) => ({
        date: t.date,
        capturedAmount: t.capturedAmountPaise / 100,
        capturedAmountInPaise: t.capturedAmountPaise,
        refunds: t.refundsPaise / 100,
        transactionCount: t.transactionCount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const paymentAnalytics: PaymentAnalytics = {
      totalPaymentAttempts,
      successfulPayments,
      failedPayments,
      pendingPayments,
      cancelledOrRefundedPayments,
      paymentSuccessRate,
      paymentMethodDistribution,
      totalCapturedAmount: totalCapturedPaise / 100,
      totalCapturedAmountInPaise: totalCapturedPaise,
      totalRefundedAmount: totalRefundedPaise / 100,
      totalRefundedAmountInPaise: totalRefundedPaise,
      refundCount,
      trends,
    };

    return {
      dateRange: {
        preset: dateRange.preset,
        groupBy: dateRange.groupBy,
        startDate: dateRange.startDateIso,
        endDate: dateRange.endDateIso,
      },
      payments: paymentAnalytics,
    };
  },
};
