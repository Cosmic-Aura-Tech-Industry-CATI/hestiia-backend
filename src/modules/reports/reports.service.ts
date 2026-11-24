import mongoose from 'mongoose';
import { db } from '../../shared/config/db.js';
import { Order } from '../orders/order.model.js';
import { Customer } from '../customers/customer.model.js';
import type {
  SalesAnalyticsResponse,
  TaxReportResponse,
  DishPerformanceItem,
} from './reports.interface.js';

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  // Formula Injection prevention (CSV Injection mitigation)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'` + str;
  }
  return `"${str}"`;
}

export const reportsService = {
  /**
   * Helper: Resolve start and end cutoff dates based on period string
   */
  resolveDateRange(period = '30days', customStart?: string, customEnd?: string) {
    const end = customEnd ? new Date(customEnd) : new Date();
    let start = new Date();

    if (customStart) {
      start = new Date(customStart);
    } else if (period === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (period === '7days') {
      start.setDate(end.getDate() - 7);
    } else if (period === '90days') {
      start.setDate(end.getDate() - 90);
    } else if (period === 'year') {
      start.setFullYear(end.getFullYear() - 1);
    } else {
      // Default 30 days
      start.setDate(end.getDate() - 30);
    }

    return { startDate: start, endDate: end };
  },

  /**
   * Comprehensive sales, tax, delivery fee & dish performance analytics
   */
  async getAnalytics(
    period = '30days',
    customStart?: string,
    customEnd?: string
  ): Promise<SalesAnalyticsResponse> {
    const { startDate, endDate } = this.resolveDateRange(period, customStart, customEnd);
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    let filteredOrders: any[] = [];
    if (mongoose.connection.readyState === 1) {
      try {
        filteredOrders = await Order.find({
          createdAt: { $gte: startDate, $lte: endDate },
        })
          .select('grandTotal taxAmount deliveryCharge discountAmount paymentStatus fulfillmentType paymentMethod items createdAt')
          .lean();
      } catch (err: any) {
        console.warn(`[ReportsService] Mongo getAnalytics error: ${err?.message}`);
      }
    }

    if (filteredOrders.length === 0) {
      const state = db.getState();
      filteredOrders = state.orders.filter(
        (o) => o.createdAt >= startIso && o.createdAt <= endIso
      );
    }

    const paidOrders = filteredOrders.filter((o) => o.paymentStatus === 'paid');

    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
    const totalTax = paidOrders.reduce((sum, o) => sum + (o.taxAmount || 0), 0);
    const totalDeliveryFee = paidOrders.reduce((sum, o) => sum + (o.deliveryCharge || 0), 0);
    const totalDiscounts = paidOrders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
    const averageOrderValue = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

    const cgst = Number((totalTax / 2).toFixed(2));
    const sgst = Number((totalTax / 2).toFixed(2));

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

    // Aggregate item sales
    const dishSalesMap: Record<string, { dishId: string; name: string; quantity: number; revenue: number }> = {};
    filteredOrders.forEach((o: any) => {
      if (o.orderStatus !== 'cancelled' && Array.isArray(o.items)) {
        o.items.forEach((item: any) => {
          const key = item.dishId || item.name;
          if (!dishSalesMap[key]) {
            dishSalesMap[key] = { dishId: item.dishId || '', name: item.name, quantity: 0, revenue: 0 };
          }
          dishSalesMap[key].quantity += item.quantity || 1;
          dishSalesMap[key].revenue += item.total || (item.price || 0) * (item.quantity || 1);
        });
      }
    });

    const topDishes: DishPerformanceItem[] = Object.values(dishSalesMap)
      .map((d) => ({
        ...d,
        averagePrice: d.quantity > 0 ? Math.round(d.revenue / d.quantity) : 0,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      period,
      startDate: startIso,
      endDate: endIso,
      totalOrders: filteredOrders.length,
      paidOrdersCount: paidOrders.length,
      totalRevenue,
      totalTax,
      cgst,
      sgst,
      totalDeliveryFee,
      totalDiscounts,
      averageOrderValue,
      fulfillmentBreakdown,
      paymentBreakdown,
      topDishes,
    };
  },

  /**
   * GST Tax Summary specifically designed for monthly GSTR-3B & GSTR-1 filing
   */
  async getTaxReport(period = '30days', customStart?: string, customEnd?: string): Promise<TaxReportResponse> {
    const analytics = await this.getAnalytics(period, customStart, customEnd);
    const taxableSales = Math.max(0, analytics.totalRevenue - analytics.totalTax);

    return {
      period,
      startDate: analytics.startDate,
      endDate: analytics.endDate,
      grossSales: analytics.totalRevenue,
      exemptOrDiscount: analytics.totalDiscounts,
      taxableSales,
      cgstAmount: analytics.cgst,
      sgstAmount: analytics.sgst,
      totalGst: analytics.totalTax,
      paidOrdersCount: analytics.paidOrdersCount,
    };
  },

  /**
   * Export complete order registry to CSV
   */
  async exportOrdersCsv(customStart?: string, customEnd?: string): Promise<string> {
    let orders: any[] = [];
    const filter: any = {};
    if (customStart || customEnd) {
      filter.createdAt = {};
      if (customStart) filter.createdAt.$gte = new Date(customStart);
      if (customEnd) filter.createdAt.$lte = new Date(customEnd);
    }

    if (mongoose.connection.readyState === 1) {
      try {
        orders = await Order.find(filter)
          .sort({ createdAt: -1 })
          .select('orderNumber createdAt customerName customerPhone fulfillmentType grandTotal subtotal taxAmount deliveryCharge discountAmount paymentMethod paymentStatus orderStatus items')
          .lean();
      } catch (err: any) {
        console.warn(`[ReportsService] Mongo exportOrdersCsv error: ${err?.message}`);
      }
    }

    if (orders.length === 0) {
      orders = db.getState().orders;
    }

    const headers = [
      'Order Number',
      'Date',
      'Customer Name',
      'Phone',
      'Fulfillment',
      'Grand Total (INR)',
      'Subtotal (INR)',
      'Tax (INR)',
      'Delivery Fee (INR)',
      'Discount (INR)',
      'Payment Method',
      'Payment Status',
      'Order Status',
      'Items',
    ];

    const rows = orders.map((o: any) => {
      const itemsSummary = (o.items || []).map((i: any) => `${i.name} (x${i.quantity})`).join('; ');
      const dateStr = o.createdAt
        ? new Date(o.createdAt).toISOString().replace('T', ' ').substring(0, 19)
        : '';
      return [
        escapeCsv(o.orderNumber),
        escapeCsv(dateStr),
        escapeCsv(o.customerName),
        escapeCsv(o.customerPhone),
        escapeCsv(o.fulfillmentType),
        escapeCsv(o.grandTotal),
        escapeCsv(o.subtotal || o.grandTotal),
        escapeCsv(o.taxAmount || 0),
        escapeCsv(o.deliveryCharge || 0),
        escapeCsv(o.discountAmount || 0),
        escapeCsv((o.paymentMethod || 'cod').toUpperCase()),
        escapeCsv((o.paymentStatus || 'pending').toUpperCase()),
        escapeCsv((o.orderStatus || 'pending').toUpperCase()),
        escapeCsv(itemsSummary),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  },

  /**
   * Export customer registry to CSV (queries Atlas Customer model with in-memory fallback)
   */
  async exportCustomersCsv(): Promise<string> {
    let customers: any[] = [];

    if (mongoose.connection.readyState === 1) {
      try {
        customers = await Customer.find().sort({ totalSpent: -1 }).lean();
      } catch (err: any) {
        console.warn(`[ReportsService] Mongo exportCustomersCsv error: ${err?.message}`);
      }
    }

    if (customers.length === 0) {
      customers = db.getState().customers;
    }

    const headers = [
      'Customer Name',
      'Phone',
      'Email',
      'Total Orders',
      'Total Spent (INR)',
      'Last Order Date',
    ];

    const rows = customers.map((c: any) => {
      const lastDate = c.lastOrderDate
        ? new Date(c.lastOrderDate).toISOString().replace('T', ' ').substring(0, 19)
        : 'N/A';

      return [
        escapeCsv(c.name),
        escapeCsv(c.phone),
        escapeCsv(c.email || 'N/A'),
        escapeCsv(c.totalOrders || 0),
        escapeCsv(c.totalSpent || 0),
        escapeCsv(lastDate),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  },

  /**
   * Export GST tax breakdown to CSV for accountant/tax audit
   */
  async exportTaxCsv(period = '30days'): Promise<string> {
    const { startDate, endDate } = this.resolveDateRange(period);
    let orders: any[] = [];

    if (mongoose.connection.readyState === 1) {
      try {
        orders = await Order.find({
          createdAt: { $gte: startDate, $lte: endDate },
          paymentStatus: 'paid',
        })
          .sort({ createdAt: -1 })
          .lean();
      } catch {}
    }

    if (orders.length === 0) {
      orders = db.getState().orders.filter((o) => o.paymentStatus === 'paid');
    }

    const headers = [
      'Order Number',
      'Date',
      'Customer Name',
      'Gross Total (INR)',
      'Taxable Amount (INR)',
      'CGST 2.5% (INR)',
      'SGST 2.5% (INR)',
      'Total GST 5% (INR)',
      'Fulfillment',
    ];

    const rows = orders.map((o: any) => {
      const gross = o.grandTotal || 0;
      const tax = o.taxAmount || Math.round((gross * 5) / 105);
      const taxable = Math.max(0, gross - tax);
      const cgst = Number((tax / 2).toFixed(2));
      const sgst = Number((tax / 2).toFixed(2));
      const dateStr = o.createdAt
        ? new Date(o.createdAt).toISOString().replace('T', ' ').substring(0, 19)
        : '';

      return [
        escapeCsv(o.orderNumber),
        escapeCsv(dateStr),
        escapeCsv(o.customerName),
        escapeCsv(gross),
        escapeCsv(taxable),
        escapeCsv(cgst),
        escapeCsv(sgst),
        escapeCsv(tax),
        escapeCsv(o.fulfillmentType),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  },

  /**
   * Export menu items profitability & popularity performance to CSV
   */
  async exportMenuPerformanceCsv(period = '30days'): Promise<string> {
    const analytics = await this.getAnalytics(period);
    const headers = ['Dish Name', 'Quantity Sold', 'Gross Revenue (INR)', 'Average Price (INR)'];

    const rows = analytics.topDishes.map((d) => [
      escapeCsv(d.name),
      escapeCsv(d.quantity),
      escapeCsv(d.revenue),
      escapeCsv(d.averagePrice),
    ].join(','));

    return [headers.join(','), ...rows].join('\r\n');
  },

  /**
   * Module health status
   */
  async getStatus() {
    return {
      module: 'reports',
      status: 'operational',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'fallback-store',
      timestamp: new Date().toISOString(),
    };
  },
};

export default reportsService;
