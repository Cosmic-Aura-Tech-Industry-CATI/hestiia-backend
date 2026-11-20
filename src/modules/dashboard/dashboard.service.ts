import { db } from '../../shared/config/db.js';

export const dashboardService = {
  async getOverview() {
    const state = db.getState();
    const today = new Date().toISOString().split('T')[0];

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
    const pendingParties = state.partyInquiries.filter((p) => ['new', 'contacted'].includes(p.status));

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
      { name: 'Pending', count: state.orders.filter((o) => o.orderStatus === 'pending').length, color: '#F59E0B' },
      { name: 'Confirmed', count: state.orders.filter((o) => o.orderStatus === 'confirmed').length, color: '#3B82F6' },
      { name: 'Preparing', count: state.orders.filter((o) => o.orderStatus === 'preparing').length, color: '#8B5CF6' },
      { name: 'Out for Delivery', count: state.orders.filter((o) => ['ready_for_pickup', 'out_for_delivery'].includes(o.orderStatus)).length, color: '#EC4899' },
      { name: 'Completed', count: state.orders.filter((o) => o.orderStatus === 'completed').length, color: '#10B981' },
      { name: 'Cancelled', count: state.orders.filter((o) => o.orderStatus === 'cancelled').length, color: '#EF4444' },
    ];

    const itemCounts: Record<string, { name: string; category: string; quantity: number; revenue: number; image?: string }> = {};
    state.orders.forEach((o) => {
      if (o.orderStatus !== 'cancelled') {
        o.items.forEach((item) => {
          if (!itemCounts[item.dishId]) {
            const dish = state.dishes.find((d) => d.id === item.dishId);
            itemCounts[item.dishId] = {
              name: item.name,
              category: dish?.category || 'Special',
              quantity: 0,
              revenue: 0,
              image: item.image || dish?.image,
            };
          }
          itemCounts[item.dishId].quantity += item.quantity;
          itemCounts[item.dishId].revenue += item.total;
        });
      }
    });

    const popularItems = Object.values(itemCounts)
      .sort((a, b) => b.quantity - a.quantity)
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
      },
      salesTrend,
      statusDistribution,
      popularItems,
      recentOrders,
      recentBookings: state.bookings.slice(0, 4),
      recentParties: state.partyInquiries.slice(0, 4),
      settings: {
        currencySymbol: state.settings.currencySymbol,
        timezone: state.settings.timezone,
        orderAcceptance: state.settings.orderAcceptanceEnabled,
      },
    };
  },
};
