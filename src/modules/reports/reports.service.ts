import { db } from '../../shared/config/db.js';

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'` + str;
  }
  return `"${str}"`;
}

export const reportsService = {
  async getAnalytics(period: string = '30days') {
    const state = db.getState();
    const now = new Date();
    let days = 30;
    if (period === '7days') days = 7;
    else if (period === '90days') days = 90;

    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - days);
    const cutoffIso = cutoffDate.toISOString();

    const filteredOrders = state.orders.filter((o) => o.createdAt >= cutoffIso);
    const paidOrders = filteredOrders.filter((o) => o.paymentStatus === 'paid');

    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.grandTotal, 0);
    const totalTax = paidOrders.reduce((sum, o) => sum + o.taxAmount, 0);
    const totalDeliveryFee = paidOrders.reduce((sum, o) => sum + o.deliveryCharge, 0);
    const averageOrderValue = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

    const fulfillmentBreakdown = {
      delivery: filteredOrders.filter((o) => o.fulfillmentType === 'delivery').length,
      dineIn: filteredOrders.filter((o) => o.fulfillmentType === 'dine-in').length,
      pickup: filteredOrders.filter((o) => o.fulfillmentType === 'pickup').length,
    };

    const paymentBreakdown = {
      online: filteredOrders.filter((o) => o.paymentMethod === 'online').length,
      upi: filteredOrders.filter((o) => o.paymentMethod === 'upi').length,
      cod: filteredOrders.filter((o) => o.paymentMethod === 'cod').length,
    };

    const dishSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    filteredOrders.forEach((o) => {
      if (o.orderStatus !== 'cancelled') {
        o.items.forEach((item) => {
          if (!dishSalesMap[item.dishId]) {
            dishSalesMap[item.dishId] = { name: item.name, quantity: 0, revenue: 0 };
          }
          dishSalesMap[item.dishId].quantity += item.quantity;
          dishSalesMap[item.dishId].revenue += item.total;
        });
      }
    });

    const topDishes = Object.values(dishSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      period,
      totalOrders: filteredOrders.length,
      paidOrdersCount: paidOrders.length,
      totalRevenue,
      totalTax,
      totalDeliveryFee,
      averageOrderValue,
      fulfillmentBreakdown,
      paymentBreakdown,
      topDishes,
    };
  },

  async exportOrdersCsv() {
    const orders = db.getState().orders;
    const headers = ['Order Number', 'Date', 'Customer Name', 'Phone', 'Fulfillment', 'Grand Total (INR)', 'Payment Method', 'Payment Status', 'Order Status', 'Items'];

    const rows = orders.map((o) => {
      const itemsSummary = o.items.map((i) => `${i.name} (x${i.quantity})`).join('; ');
      return [
        escapeCsv(o.orderNumber),
        escapeCsv(o.createdAt.replace('T', ' ').substring(0, 19)),
        escapeCsv(o.customerName),
        escapeCsv(o.customerPhone),
        escapeCsv(o.fulfillmentType),
        escapeCsv(o.grandTotal),
        escapeCsv(o.paymentMethod.toUpperCase()),
        escapeCsv(o.paymentStatus.toUpperCase()),
        escapeCsv(o.orderStatus.toUpperCase()),
        escapeCsv(itemsSummary),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  },

  async exportCustomersCsv() {
    const customers = db.getState().customers;
    const headers = ['Customer Name', 'Phone', 'Email', 'Total Orders', 'Total Spent (INR)', 'Last Order Date'];

    const rows = customers.map((c) => [
      escapeCsv(c.name),
      escapeCsv(c.phone),
      escapeCsv(c.email || 'N/A'),
      escapeCsv(c.totalOrders),
      escapeCsv(c.totalSpent),
      escapeCsv(c.lastOrderDate.replace('T', ' ').substring(0, 19)),
    ].join(','));

    return [headers.join(','), ...rows].join('\r\n');
  },
};
