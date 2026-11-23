export interface ReportPeriodFilter {
  period?: 'today' | '7days' | '30days' | '90days' | 'year' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface DishPerformanceItem {
  dishId: string;
  name: string;
  category?: string;
  quantity: number;
  revenue: number;
  averagePrice: number;
}

export interface SalesAnalyticsResponse {
  period: string;
  startDate: string;
  endDate: string;
  totalOrders: number;
  paidOrdersCount: number;
  totalRevenue: number;
  totalTax: number;
  cgst: number;
  sgst: number;
  totalDeliveryFee: number;
  totalDiscounts: number;
  averageOrderValue: number;
  fulfillmentBreakdown: {
    delivery: number;
    dineIn: number;
    pickup: number;
  };
  paymentBreakdown: {
    online: number;
    upi: number;
    cod: number;
  };
  topDishes: DishPerformanceItem[];
}

export interface TaxReportResponse {
  period: string;
  startDate: string;
  endDate: string;
  grossSales: number;
  exemptOrDiscount: number;
  taxableSales: number;
  cgstAmount: number;
  sgstAmount: number;
  totalGst: number;
  paidOrdersCount: number;
}
