import { AppError } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';
import { escapeRegex } from '@/lib/regex';
import { CustomerModel, ICustomer } from '@/models/Customer.model';
import { IOrder, OrderModel } from '@/models/Order.model';
import { cleanDoc, cleanDocs } from '@/models/_schema';

export const customersService = {
  async getCustomers(query: any) {
    await connectDB();
    const { search, page = '1', limit = '20', sortBy = 'totalSpent' } = query;

    const filter: Record<string, any> = {};
    if (search) {
      const rx = new RegExp(escapeRegex(String(search)), 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
    }

    const sortField: Record<string, -1> =
      sortBy === 'totalSpent'
        ? { totalSpent: -1 }
        : sortBy === 'totalOrders'
          ? { totalOrders: -1 }
          : { lastOrderDate: -1 };

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [total, rawCustomers] = await Promise.all([
      CustomerModel.countDocuments(filter),
      CustomerModel.find(filter).sort(sortField).skip(skip).limit(limitNum).lean(),
    ]);

    return {
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      customers: cleanDocs<ICustomer>(rawCustomers),
    };
  },

  async getCustomerById(id: string) {
    await connectDB();
    const customerDoc = await CustomerModel.findOne({ id }).lean();
    if (!customerDoc) {
      throw new AppError('Customer not found.', 404);
    }

    const customer = cleanDoc<ICustomer>(customerDoc);
    const cleanPhone = customer.phone.replace(/\D/g, '');
    const allOrders = await OrderModel.find({}).sort({ createdAt: -1 }).lean();
    const orders = cleanDocs<IOrder>(allOrders).filter(
      (o) => o.customerPhone.replace(/\D/g, '') === cleanPhone
    );

    return { customer, orders };
  },
};
