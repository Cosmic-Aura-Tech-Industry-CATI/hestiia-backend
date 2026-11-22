import { db } from '../../../shared/config/db.js';
import { analyticsRepository } from '../repositories/analytics.repository.js';
import { CategorySalesItem, DateFilterQuery, ProductPerformanceAnalytics, ProductPerformanceItem } from '../types/analytics.types.js';
import { parseDateFilter } from '../utils/date-filter.util.js';

export const analyticsProductsService = {
  /**
   * Product and category sales performance reporting
   */
  async getProductPerformance(query: DateFilterQuery): Promise<{ dateRange: any; products: ProductPerformanceAnalytics }> {
    const dateRange = parseDateFilter(query);

    const orders = await analyticsRepository.getOrdersInRange({
      startDateIso: dateRange.startDateIso,
      endDateIso: dateRange.endDateIso,
    });

    const menuDishes = db.getState().dishes || [];
    const dishCategoryMap = new Map<string, string>();
    menuDishes.forEach((d) => {
      dishCategoryMap.set(d.id, d.category || 'Uncategorized');
      if (d.slug) dishCategoryMap.set(d.slug, d.category || 'Uncategorized');
    });

    const productMap = new Map<string, ProductPerformanceItem>();

    // Seed available menu dishes so products with 0 sales are accurately recognized
    menuDishes.forEach((d) => {
      productMap.set(d.id, {
        dishId: d.id,
        name: d.name,
        category: d.category || 'Uncategorized',
        unitPrice: d.price,
        unitPriceInPaise: Math.round(d.price * 100),
        quantitySold: 0,
        revenue: 0,
        revenueInPaise: 0,
        orderCount: 0,
      });
    });

    let totalQuantitySold = 0;
    let totalRevenuePaise = 0;
    const categoryTotals = new Map<string, { quantity: number; revenuePaise: number }>();

    orders.forEach((o) => {
      // Exclude cancelled orders
      if (o.orderStatus !== 'cancelled' && Array.isArray(o.items)) {
        const orderProcessedDishes = new Set<string>();

        o.items.forEach((item) => {
          const key = item.dishId || item.name;
          const category = dishCategoryMap.get(item.dishId) || dishCategoryMap.get(key) || 'Uncategorized';
          const itemPrice = item.price;
          const itemPricePaise = item.priceInPaise ?? Math.round(item.price * 100);
          const itemTotalPaise = item.totalInPaise ?? Math.round(item.total * 100);
          const itemQuantity = item.quantity || 1;

          totalQuantitySold += itemQuantity;
          totalRevenuePaise += itemTotalPaise;

          const existing = productMap.get(key) || {
            dishId: item.dishId || key,
            name: item.name,
            category,
            unitPrice: itemPrice,
            unitPriceInPaise: itemPricePaise,
            quantitySold: 0,
            revenue: 0,
            revenueInPaise: 0,
            orderCount: 0,
          };

          existing.quantitySold += itemQuantity;
          existing.revenueInPaise += itemTotalPaise;
          existing.revenue = existing.revenueInPaise / 100;

          if (!orderProcessedDishes.has(key)) {
            existing.orderCount += 1;
            orderProcessedDishes.add(key);
          }

          productMap.set(key, existing);

          // Category aggregation
          const cat = categoryTotals.get(category) || { quantity: 0, revenuePaise: 0 };
          cat.quantity += itemQuantity;
          cat.revenuePaise += itemTotalPaise;
          categoryTotals.set(category, cat);
        });
      }
    });

    const allProducts = Array.from(productMap.values());

    const bestSellingProducts = [...allProducts]
      .filter((p) => p.quantitySold > 0)
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10);

    const highestRevenueProducts = [...allProducts]
      .filter((p) => p.revenueInPaise > 0)
      .sort((a, b) => b.revenueInPaise - a.revenueInPaise)
      .slice(0, 10);

    const lowPerformingProducts = [...allProducts]
      .sort((a, b) => a.quantitySold - b.quantitySold)
      .slice(0, 10);

    const categoryWiseSales: CategorySalesItem[] = Array.from(categoryTotals.entries())
      .map(([category, stats]) => ({
        category,
        quantitySold: stats.quantity,
        revenue: stats.revenuePaise / 100,
        revenueInPaise: stats.revenuePaise,
        percentage: totalRevenuePaise > 0 ? Math.round((stats.revenuePaise / totalRevenuePaise) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenueInPaise - a.revenueInPaise);

    const products: ProductPerformanceAnalytics = {
      totalQuantitySold,
      totalProductRevenue: totalRevenuePaise / 100,
      totalProductRevenueInPaise: totalRevenuePaise,
      bestSellingProducts,
      highestRevenueProducts,
      lowPerformingProducts,
      categoryWiseSales,
      allProducts,
    };

    return {
      dateRange: {
        preset: dateRange.preset,
        startDate: dateRange.startDateIso,
        endDate: dateRange.endDateIso,
      },
      products,
    };
  },
};
