import { db } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';

export const customersService = {
  async getCustomers(query: any) {
    const { search, page = '1', limit = '20', sortBy = 'totalSpent' } = query;
    let customers = [...db.getState().customers];

    if (search) {
      const q = String(search).toLowerCase();
      customers = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'totalSpent') {
      customers.sort((a, b) => b.totalSpent - a.totalSpent);
    } else if (sortBy === 'totalOrders') {
      customers.sort((a, b) => b.totalOrders - a.totalOrders);
    } else {
      customers.sort((a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime());
    }

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = customers.slice(startIndex, startIndex + limitNum);

    return {
      total: customers.length,
      page: pageNum,
      totalPages: Math.ceil(customers.length / limitNum),
      customers: paginated,
    };
  },

  async getCustomerById(id: string) {
    const state = db.getState();
    const customer = state.customers.find((c) => c.id === id);
    if (!customer) {
      throw new AppError('Customer not found.', 404);
    }

    const cleanPhone = customer.phone.replace(/\D/g, '');
    const orders = state.orders.filter((o) => o.customerPhone.replace(/\D/g, '') === cleanPhone);

    return { customer, orders };
  },
};
