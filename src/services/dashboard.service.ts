import { connectDB } from '@/lib/mongodb';
import { BookingModel, ITableBooking } from '@/models/Booking.model';
import { CustomerModel } from '@/models/Customer.model';
import { DishModel, IFoodItem } from '@/models/Dish.model';
import { IOrder, OrderModel } from '@/models/Order.model';
import { IPartyInquiry, PartyInquiryModel } from '@/models/PartyInquiry.model';
import { settingsService } from './settings.service';
import { cleanDocs } from '@/models/_schema';

export const dashboardService = {
  async getOverview() {
    await connectDB();

    const [
      rawOrders,
      rawDishes,
      totalCustomers,
      rawBookings,
      rawParties,
      settings,
    ] = await Promise.all([
      OrderModel.find({}).sort({ createdAt: -1 }).lean(),
      DishModel.find({}).lean(),
      CustomerModel.countDocuments(),
      BookingModel.find({}).sort({ createdAt: -1 }).lean(),
      PartyInquiryModel.find({}).sort({ createdAt: -1 }).lean(),
      settingsService.getAdminSettings(),
    ]);

    const orders = cleanDocs<IOrder>(rawOrders);
    const dishes = cleanDocs<IFoodItem>(rawDishes);
    const bookings = cleanDocs<ITableBooking>(rawBookings);
    const partyInquiries = cleanDocs<IPartyInquiry>(rawParties);

    const today = new Date().toISOString().split('T')[0];

    const todayOrders = orders.filter((o) => o.createdAt.startsWith(today));
    const pendingOrders = orders.filter((o) => o.orderStatus === 'pending');
    const activeOrders = orders.filter((o) =>
      ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(
        o.orderStatus
      )
    );
    const completedOrders = orders.filter((o) => o.orderStatus === 'completed');

    const todayRevenue = todayOrders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((acc, o) => acc + o.grandTotal, 0);

    const totalVerifiedRevenue = orders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((acc, o) => acc + o.grandTotal, 0);

    const pendingBookings = bookings.filter((b) =>
      ['new', 'contacted'].includes(b.status)
    );
    const pendingParties = partyInquiries.filter((p) =>
      ['new', 'contacted'].includes(p.status)
    );

    const last7DaysMap: Record<
      string,
      { date: string; revenue: number; orders: number }
    > = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const displayStr = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      last7DaysMap[dateStr] = { date: displayStr, revenue: 0, orders: 0 };
    }

    orders.forEach((o) => {
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
        count: orders.filter((o) => o.orderStatus === 'pending').length,
        color: '#F59E0B',
      },
      {
        name: 'Confirmed',
        count: orders.filter((o) => o.orderStatus === 'confirmed').length,
        color: '#3B82F6',
      },
      {
        name: 'Preparing',
        count: orders.filter((o) => o.orderStatus === 'preparing').length,
        color: '#8B5CF6',
      },
      {
        name: 'Out for Delivery',
        count: orders.filter((o) =>
          ['ready_for_pickup', 'out_for_delivery'].includes(o.orderStatus)
        ).length,
        color: '#EC4899',
      },
      {
        name: 'Completed',
        count: orders.filter((o) => o.orderStatus === 'completed').length,
        color: '#10B981',
      },
      {
        name: 'Cancelled',
        count: orders.filter((o) => o.orderStatus === 'cancelled').length,
        color: '#EF4444',
      },
    ];

    const itemCounts: Record<
      string,
      {
        name: string;
        category: string;
        quantity: number;
        revenue: number;
        image?: string;
      }
    > = {};

    orders.forEach((o) => {
      if (o.orderStatus !== 'cancelled') {
        o.items.forEach((item) => {
          if (!itemCounts[item.dishId]) {
            const dish = dishes.find((d) => d.id === item.dishId);
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

    return {
      metrics: {
        todayOrdersCount: todayOrders.length,
        pendingOrdersCount: pendingOrders.length,
        activeOrdersCount: activeOrders.length,
        completedOrdersCount: completedOrders.length,
        todayRevenue,
        totalVerifiedRevenue,
        totalCustomers,
        totalDishesCount: dishes.length,
        unavailableDishesCount: dishes.filter((d) => !d.available).length,
        pendingBookingsCount: pendingBookings.length,
        pendingPartiesCount: pendingParties.length,
      },
      salesTrend,
      statusDistribution,
      popularItems,
      recentOrders: orders.slice(0, 5),
      recentBookings: bookings.slice(0, 4),
      recentParties: partyInquiries.slice(0, 4),
      settings: {
        currencySymbol: settings.currencySymbol,
        timezone: settings.timezone,
        orderAcceptance: settings.orderAcceptanceEnabled,
      },
    };
  },
};
