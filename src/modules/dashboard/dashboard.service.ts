import mongoose from 'mongoose';
import { db } from '../../shared/config/db.js';
import { Customer } from '../customers/customer.model.js';
import { MenuItem } from '../menu/menu.model.js';
import { Order } from '../orders/order.model.js';
import { PartyInquiry } from '../party/party.model.js';
import { Booking } from '../bookings/booking.model.js';
import { Contact } from '../contact/contact.model.js';
import { Conversation } from '../conversations/conversation.model.js';
import type {
  DashboardOverviewResponse,
  SalesTrendPoint,
  PopularItem,
} from './dashboard.interface.js';

export const dashboardService = {
  /**
   * Consolidated Executive Overview Metrics for Management Dashboard
   */
  async getOverview(): Promise<DashboardOverviewResponse> {
    const state = db.getState();
    const today = new Date().toISOString().split('T')[0];

    // 1. Direct MongoDB Atlas Aggregation
    if (mongoose.connection.readyState === 1) {
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [
          totalOrdersCount,
          todayOrdersCount,
          pendingOrdersCount,
          activeOrdersCount,
          completedOrdersCount,
          todayPaidOrders,
          allPaidOrders,
          recentOrdersDocs,
          recentBookingsDocs,
          totalCustomersCount,
          totalDishesCount,
          unavailableDishesCount,
          pendingPartiesCount,
          pendingBookingsCount,
          pendingContactCount,
          unreadChatCount,
          statusGroupResults,
          popularItemsAggregation,
        ] = await Promise.all([
          Order.countDocuments(),
          Order.countDocuments({ createdAt: { $gte: startOfToday } }),
          Order.countDocuments({ orderStatus: 'pending' }),
          Order.countDocuments({
            orderStatus: { $in: ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'] },
          }),
          Order.countDocuments({ orderStatus: 'completed' }),
          // Database-level sums via atomic aggregation (zero document transfer over wire)
          Order.aggregate([
            { $match: { createdAt: { $gte: startOfToday }, paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$grandTotal' } } },
          ]),
          Order.aggregate([
            { $match: { paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$grandTotal' } } },
          ]),
          Order.find().sort({ createdAt: -1 }).limit(5).lean(),
          Booking.find().sort({ createdAt: -1 }).limit(4).lean(),
          Customer.countDocuments().catch(() => state.customers.length),
          MenuItem.countDocuments().catch(() => state.dishes.length),
          MenuItem.countDocuments({ available: false }).catch(() => 0),
          PartyInquiry.countDocuments({ status: { $in: ['new', 'contacted'] } }).catch(() => 0),
          Booking.countDocuments({ status: { $in: ['new', 'contacted'] } }).catch(() => 0),
          Contact.countDocuments({ status: 'new' }).catch(() => 0),
          Conversation.countDocuments({ senderRole: 'customer', isRead: false }).catch(() => 0),
          // Atomic aggregation for status distribution (eliminates sequential queries)
          Order.aggregate([
            {
              $group: {
                _id: '$orderStatus',
                count: { $sum: 1 },
              },
            },
          ]).catch(() => []),
          // Top 5 popular items by quantity & revenue
          Order.aggregate([
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.name',
                orderCount: { $sum: '$items.quantity' },
                totalRevenue: {
                  $sum: { $multiply: [{ $ifNull: ['$items.price', 0] }, '$items.quantity'] },
                },
              },
            },
            { $sort: { orderCount: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 0,
                name: '$_id',
                orderCount: 1,
                totalRevenue: 1,
              },
            },
          ]).catch(() => []),
        ]);

        const todayRevenue = (todayPaidOrders as any[])?.[0]?.total || 0;
        const totalVerifiedRevenue = (allPaidOrders as any[])?.[0]?.total || 0;

        // Map status aggregation counts
        const statusMap: Record<string, number> = {};
        statusGroupResults.forEach((s: any) => {
          if (s._id) statusMap[s._id] = s.count;
        });

        const statusDistribution = [
          { name: 'Pending', count: statusMap['pending'] || pendingOrdersCount, color: '#F59E0B' },
          { name: 'Confirmed', count: statusMap['confirmed'] || 0, color: '#3B82F6' },
          { name: 'Preparing', count: statusMap['preparing'] || 0, color: '#8B5CF6' },
          {
            name: 'Out for Delivery',
            count: (statusMap['ready_for_pickup'] || 0) + (statusMap['out_for_delivery'] || 0),
            color: '#EC4899',
          },
          { name: 'Completed', count: statusMap['completed'] || completedOrdersCount, color: '#10B981' },
          { name: 'Cancelled', count: statusMap['cancelled'] || 0, color: '#EF4444' },
        ];

        // 7-day sales trend
        const salesTrend = await this.getSalesTrend(7);

        return {
          metrics: {
            todayOrdersCount,
            pendingOrdersCount,
            activeOrdersCount,
            completedOrdersCount,
            todayRevenue,
            totalVerifiedRevenue,
            totalCustomers: totalCustomersCount,
            totalDishesCount,
            unavailableDishesCount,
            pendingBookingsCount,
            pendingPartiesCount,
            pendingContactInquiriesCount: pendingContactCount,
            unreadChatMessagesCount: unreadChatCount,
          },
          salesTrend,
          statusDistribution,
          popularItems: popularItemsAggregation as PopularItem[],
          recentOrders: recentOrdersDocs,
          recentBookings: recentBookingsDocs,
        };
      } catch (err: any) {
        console.warn(
          `[Dashboard] Atlas aggregation failed, falling back to local store: ${err?.message}`
        );
      }
    }

    // 2. Resilient Fallback to Local Store
    const todayOrders = state.orders.filter((o) => o.createdAt.startsWith(today));
    const pendingOrders = state.orders.filter((o) => o.orderStatus === 'pending');
    const activeOrders = state.orders.filter((o) =>
      ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(o.orderStatus)
    );
    const completedOrders = state.orders.filter((o) => o.orderStatus === 'completed');

    const todayRevenue = todayOrders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((acc, o) => acc + o.grandTotal, 0);

    const totalVerifiedRevenue = state.orders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((acc, o) => acc + o.grandTotal, 0);

    const pendingBookings = state.bookings.filter((b) => ['new', 'contacted'].includes(b.status));
    const pendingParties = state.partyInquiries.filter((p) =>
      ['new', 'contacted'].includes(p.status)
    );

    const last7DaysMap: Record<string, { date: string; revenue: number; orders: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      last7DaysMap[dateStr] = { date: displayStr, revenue: 0, orders: 0 };
    }

    state.orders.forEach((o) => {
      const orderDate = o.createdAt.split('T')[0];
      if (last7DaysMap[orderDate]) {
        last7DaysMap[orderDate].orders += 1;
        if (o.paymentStatus === 'paid') {
          last7DaysMap[orderDate].revenue += o.grandTotal;
        }
      }
    });

    const salesTrend = Object.values(last7DaysMap);

    const statusDistribution = [
      {
        name: 'Pending',
        count: state.orders.filter((o) => o.orderStatus === 'pending').length,
        color: '#F59E0B',
      },
      {
        name: 'Confirmed',
        count: state.orders.filter((o) => o.orderStatus === 'confirmed').length,
        color: '#3B82F6',
      },
      {
        name: 'Preparing',
        count: state.orders.filter((o) => o.orderStatus === 'preparing').length,
        color: '#8B5CF6',
      },
      {
        name: 'Out for Delivery',
        count: state.orders.filter((o) =>
          ['ready_for_pickup', 'out_for_delivery'].includes(o.orderStatus)
        ).length,
        color: '#EC4899',
      },
      {
        name: 'Completed',
        count: state.orders.filter((o) => o.orderStatus === 'completed').length,
        color: '#10B981',
      },
      {
        name: 'Cancelled',
        count: state.orders.filter((o) => o.orderStatus === 'cancelled').length,
        color: '#EF4444',
      },
    ];

    // Compute popular items in fallback mode
    const itemMap: Record<string, { name: string; orderCount: number; totalRevenue: number }> = {};
    state.orders.forEach((o) => {
      o.items?.forEach((item: any) => {
        const name = item.name || item.dishName || 'Unknown Item';
        if (!itemMap[name]) itemMap[name] = { name, orderCount: 0, totalRevenue: 0 };
        itemMap[name].orderCount += item.quantity || 1;
        itemMap[name].totalRevenue += (item.price || 0) * (item.quantity || 1);
      });
    });
    const fallbackPopularItems = Object.values(itemMap)
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 5);

    const recentOrders = [...state.orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return {
      metrics: {
        todayOrdersCount: todayOrders.length,
        pendingOrdersCount: pendingOrders.length,
        activeOrdersCount: activeOrders.length,
        completedOrdersCount: completedOrders.length,
        todayRevenue,
        totalVerifiedRevenue,
        totalCustomers: state.customers.length,
        totalDishesCount: state.dishes.length,
        unavailableDishesCount: state.dishes.filter((d) => !d.available).length,
        pendingBookingsCount: pendingBookings.length,
        pendingPartiesCount: pendingParties.length,
        pendingContactInquiriesCount: 0,
        unreadChatMessagesCount: 0,
      },
      salesTrend,
      statusDistribution,
      popularItems: fallbackPopularItems,
      recentOrders,
      recentBookings: state.bookings.slice(0, 4),
    };
  },

  /**
   * Get dynamic sales trend for specified number of days (default 7 days)
   */
  async getSalesTrend(days = 7): Promise<SalesTrendPoint[]> {
    const daysCount = Math.max(1, Math.min(90, days));
    const trendMap: Record<string, { date: string; revenue: number; orders: number }> = {};

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      trendMap[dateStr] = { date: displayStr, revenue: 0, orders: 0 };
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);
        startDate.setHours(0, 0, 0, 0);

        const salesByDay = await Order.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              orders: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$grandTotal', 0],
                },
              },
            },
          },
        ]);

        salesByDay.forEach((s: any) => {
          if (trendMap[s._id]) {
            trendMap[s._id].orders = s.orders || 0;
            trendMap[s._id].revenue = s.revenue || 0;
          }
        });

        return Object.values(trendMap);
      } catch (err: any) {
        console.warn(`[Dashboard] SalesTrend Mongo error: ${err?.message}`);
      }
    }

    // Fallback store
    const state = db.getState();
    state.orders.forEach((o) => {
      const orderDate = o.createdAt.split('T')[0];
      if (trendMap[orderDate]) {
        trendMap[orderDate].orders += 1;
        if (o.paymentStatus === 'paid') {
          trendMap[orderDate].revenue += o.grandTotal;
        }
      }
    });

    return Object.values(trendMap);
  },

  /**
   * Retrieve top-selling menu items by quantity and revenue
   */
  async getPopularItems(limit = 10): Promise<PopularItem[]> {
    const take = Math.max(1, Math.min(50, limit));

    if (mongoose.connection.readyState === 1) {
      try {
        const topItems = await Order.aggregate([
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.name',
              orderCount: { $sum: '$items.quantity' },
              totalRevenue: {
                $sum: { $multiply: [{ $ifNull: ['$items.price', 0] }, '$items.quantity'] },
              },
            },
          },
          { $sort: { orderCount: -1 } },
          { $limit: take },
          {
            $project: {
              _id: 0,
              name: '$_id',
              orderCount: 1,
              totalRevenue: 1,
            },
          },
        ]);
        return topItems as PopularItem[];
      } catch (err: any) {
        console.warn(`[Dashboard] PopularItems Mongo error: ${err?.message}`);
      }
    }

    const state = db.getState();
    const itemMap: Record<string, { name: string; orderCount: number; totalRevenue: number }> = {};
    state.orders.forEach((o) => {
      o.items?.forEach((item: any) => {
        const name = item.name || item.dishName || 'Unknown Dish';
        if (!itemMap[name]) itemMap[name] = { name, orderCount: 0, totalRevenue: 0 };
        itemMap[name].orderCount += item.quantity || 1;
        itemMap[name].totalRevenue += (item.price || 0) * (item.quantity || 1);
      });
    });

    return Object.values(itemMap)
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, take);
  },

  /**
   * Retrieve real-time active kitchen orders for live dashboard monitor
   */
  async getLiveOrders(): Promise<any[]> {
    const activeStatuses: any[] = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'];

    if (mongoose.connection.readyState === 1) {
      try {
        const orders = await Order.find({ orderStatus: { $in: activeStatuses } })
          .sort({ createdAt: 1 })
          .lean();

        const now = Date.now();
        return orders.map((o: any) => ({
          ...o,
          elapsedMinutes: Math.floor((now - new Date(o.createdAt).getTime()) / 60000),
        }));
      } catch (err: any) {
        console.warn(`[Dashboard] LiveOrders Mongo error: ${err?.message}`);
      }
    }

    const state = db.getState();
    const now = Date.now();
    return state.orders
      .filter((o) => activeStatuses.includes(o.orderStatus))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((o) => ({
        ...o,
        elapsedMinutes: Math.floor((now - new Date(o.createdAt).getTime()) / 60000),
      }));
  },
};

export default dashboardService;
