export interface DashboardMetrics {
  todayOrdersCount: number;
  pendingOrdersCount: number;
  activeOrdersCount: number;
  completedOrdersCount: number;
  todayRevenue: number;
  totalVerifiedRevenue: number;
  totalCustomers: number;
  totalDishesCount: number;
  unavailableDishesCount: number;
  pendingBookingsCount: number;
  pendingPartiesCount: number;
  pendingContactInquiriesCount?: number;
  unreadChatMessagesCount?: number;
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface StatusDistributionItem {
  name: string;
  count: number;
  color: string;
}

export interface PopularItem {
  name: string;
  orderCount: number;
  totalRevenue: number;
}

export interface DashboardOverviewResponse {
  metrics: DashboardMetrics;
  salesTrend: SalesTrendPoint[];
  statusDistribution: StatusDistributionItem[];
  popularItems: PopularItem[];
  recentOrders: any[];
  recentBookings: any[];
}
