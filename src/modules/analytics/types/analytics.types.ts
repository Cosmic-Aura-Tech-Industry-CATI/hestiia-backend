export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisweek'
  | 'thismonth'
  | 'previousmonth'
  | 'custom';

export type GroupByInterval = 'day' | 'week' | 'month';

export interface DateFilterQuery {
  preset?: DatePreset;
  startDate?: string;
  endDate?: string;
  groupBy?: GroupByInterval;
  limit?: string | number;
}

export interface ResolvedDateRange {
  startDate: Date;
  endDate: Date;
  startDateIso: string;
  endDateIso: string;
  preset: DatePreset;
  groupBy: GroupByInterval;
  previousStartDate: Date;
  previousEndDate: Date;
  previousStartDateIso: string;
  previousEndDateIso: string;
}

export interface OverviewMetrics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalSales: number;
  totalSalesInPaise: number;
  collectedRevenue: number;
  collectedRevenueInPaise: number;
  totalRefunds: number;
  totalRefundsInPaise: number;
  averageOrderValue: number;
  averageOrderValueInPaise: number;
  uniqueCustomers: number;
  returningCustomers: number;
  bestSellingProduct: {
    dishId: string;
    name: string;
    quantitySold: number;
    revenue: number;
    revenueInPaise: number;
  } | null;
}

export interface RevenueTrendPoint {
  date: string;
  grossSales: number;
  grossSalesInPaise: number;
  discounts: number;
  discountsInPaise: number;
  netSales: number;
  netSalesInPaise: number;
  collectedRevenue: number;
  collectedRevenueInPaise: number;
  refunds: number;
  refundsInPaise: number;
  orderCount: number;
}

export interface RevenueAnalytics {
  grossSales: number;
  grossSalesInPaise: number;
  discounts: number;
  discountsInPaise: number;
  netSales: number;
  netSalesInPaise: number;
  collectedRevenue: number;
  collectedRevenueInPaise: number;
  refundAmounts: number;
  refundAmountsInPaise: number;
  averageOrderValue: number;
  averageOrderValueInPaise: number;
  comparison: {
    previousCollectedRevenue: number;
    revenueChangePercent: number;
    previousNetSales: number;
    netSalesChangePercent: number;
    previousTotalOrders: number;
    ordersChangePercent: number;
  };
  trends: RevenueTrendPoint[];
}

export interface OrderAnalytics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  ordersByStatus: Record<string, number>;
  ordersByType: {
    delivery: number;
    pickup: number;
    dineIn: number;
  };
  peakOrderingHours: Array<{
    hour: number;
    formattedHour: string;
    orderCount: number;
    percentage: number;
  }>;
  trends: Array<{
    date: string;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
  }>;
  averageOrderValue: number;
  averageOrderValueInPaise: number;
  averagePreparationTimeMinutes: number | null;
}

export interface ProductPerformanceItem {
  dishId: string;
  name: string;
  category: string;
  unitPrice: number;
  unitPriceInPaise: number;
  quantitySold: number;
  revenue: number;
  revenueInPaise: number;
  orderCount: number;
}

export interface CategorySalesItem {
  category: string;
  quantitySold: number;
  revenue: number;
  revenueInPaise: number;
  percentage: number;
}

export interface ProductPerformanceAnalytics {
  totalQuantitySold: number;
  totalProductRevenue: number;
  totalProductRevenueInPaise: number;
  bestSellingProducts: ProductPerformanceItem[];
  highestRevenueProducts: ProductPerformanceItem[];
  lowPerformingProducts: ProductPerformanceItem[];
  categoryWiseSales: CategorySalesItem[];
  allProducts: ProductPerformanceItem[];
}

export interface CustomerAnalytics {
  totalUniqueCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatPurchaseRate: number;
  averageOrdersPerCustomer: number;
  averageCustomerSpending: number;
  averageCustomerSpendingInPaise: number;
  highestValueCustomers: Array<{
    phone: string;
    name: string;
    totalOrders: number;
    totalSpent: number;
    totalSpentInPaise: number;
    lastOrderDate: string;
  }>;
  orderingFrequency: {
    oneTime: number;
    twoToFive: number;
    sixPlus: number;
  };
}

export interface PaymentAnalytics {
  totalPaymentAttempts: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  cancelledOrRefundedPayments: number;
  paymentSuccessRate: number;
  paymentMethodDistribution: {
    online: number;
    upi: number;
    cod: number;
  };
  totalCapturedAmount: number;
  totalCapturedAmountInPaise: number;
  totalRefundedAmount: number;
  totalRefundedAmountInPaise: number;
  refundCount: number;
  trends: Array<{
    date: string;
    capturedAmount: number;
    capturedAmountInPaise: number;
    refunds: number;
    transactionCount: number;
  }>;
}
