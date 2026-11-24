import mongoose from 'mongoose';
import { Customer, type ICustomerDocument } from './customer.model.js';
import { Order } from '../orders/order.model.js';
import { db } from '../../shared/config/store.js';
import { AppError } from '../../shared/utils/appError.js';

export const customersService = {
  /**
   * Format customer document for uniform API responses
   */
  formatCustomer(doc: any) {
    const id = doc?._id ? doc._id.toString() : (doc?.id || '');
    return {
      id,
      _id: doc?._id || id,
      name: doc?.name || '',
      phone: doc?.phone || '',
      email: doc?.email || '',
      address: doc?.address || '',
      notes: doc?.notes || '',
      totalOrders: doc?.totalOrders ?? 0,
      totalSpent: doc?.totalSpent ?? 0,
      lastOrderDate: doc?.lastOrderDate || null,
      createdAt: doc?.createdAt || new Date(),
      updatedAt: doc?.updatedAt || new Date(),
    };
  },

  /**
   * Lookup helper: by ObjectId or phone number
   */
  async findCustomerDoc(idOrPhone: string) {
    if (mongoose.Types.ObjectId.isValid(idOrPhone)) {
      const byId = await Customer.findById(idOrPhone);
      if (byId) return byId;
    }
    const cleanPhone = idOrPhone.trim();
    return Customer.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: cleanPhone.replace(/\D/g, '') },
      ],
    });
  },

  /**
   * 1. Get Customers (Optimized lean query with compound index sorting & pagination)
   */
  async getCustomers(query: any) {
    const { search, page = '1', limit = '20', sortBy = 'totalSpent', sortOrder = 'desc' } = query;

    const filter: any = {};

    if (search && String(search).trim()) {
      const term = String(search).trim();
      const escaped = term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const sortDir = sortOrder === 'asc' ? 1 : -1;
    let sortOptions: any = { totalSpent: sortDir, createdAt: -1 };

    if (sortBy === 'totalOrders') {
      sortOptions = { totalOrders: sortDir, createdAt: -1 };
    } else if (sortBy === 'lastOrderDate') {
      sortOptions = { lastOrderDate: sortDir, createdAt: -1 };
    } else if (sortBy === 'createdAt') {
      sortOptions = { createdAt: sortDir };
    } else if (sortBy === 'name') {
      sortOptions = { name: sortDir };
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, docs] = await Promise.all([
      Customer.countDocuments(filter),
      Customer.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return {
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      customers: docs.map((c) => this.formatCustomer(c)),
    };
  },

  /**
   * 2. Get Single Customer by ID (with order history)
   */
  async getCustomerById(id: string) {
    let customer: any = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      customer = await Customer.findById(id).lean();
    }

    if (!customer) {
      customer = await Customer.findOne({
        $or: [{ phone: id }, { phone: id.replace(/\D/g, '') }],
      }).lean();
    }

    if (!customer) {
      throw new AppError('Customer not found.', 404);
    }

    // Retrieve order history matching customer phone (utilizing compound index { customerPhone: 1, createdAt: -1 })
    const cleanPhone = (customer.phone || '').replace(/\D/g, '');
    let orders: any[] = [];
    if (mongoose.connection.readyState === 1) {
      try {
        orders = await Order.find({
          $or: [{ customerPhone: cleanPhone }, { customerPhone: customer.phone }],
        })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean();
      } catch {}
    }

    if (orders.length === 0) {
      orders = (db.getState().orders || []).filter(
        (o) => (o.customerPhone || '').replace(/\D/g, '') === cleanPhone
      );
    }

    return {
      customer: this.formatCustomer(customer),
      orders,
    };
  },

  /**
   * 3. Create Customer (Direct MongoDB Atlas insertion with duplicate phone guard)
   */
  async createCustomer(data: any, username = 'admin') {
    const { name, phone, email, address, notes } = data;

    if (!name || !name.trim()) {
      throw new AppError('Customer name is required.', 400);
    }
    if (!phone || !phone.trim()) {
      throw new AppError('Customer phone number is required.', 400);
    }

    const cleanPhone = phone.trim();

    // Check duplicate
    const existing = await Customer.findOne({
      $or: [{ phone: cleanPhone }, { phone: cleanPhone.replace(/\D/g, '') }],
    }).lean();

    if (existing) {
      throw new AppError(`A customer with phone number '${cleanPhone}' already exists in the database.`, 409);
    }

    try {
      const created = await Customer.create({
        name: name.trim(),
        phone: cleanPhone,
        email: email ? email.trim().toLowerCase() : '',
        address: address ? address.trim() : '',
        notes: notes ? notes.trim() : '',
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: null,
      });

      db.logAudit('CREATE_CUSTOMER', username, `Created customer: ${created.name} (${created.phone})`);
      return this.formatCustomer(created.toJSON());
    } catch (err: any) {
      if (err.code === 11000) {
        throw new AppError(`A customer with phone number '${cleanPhone}' already exists.`, 409);
      }
      throw err;
    }
  },

  /**
   * 4. Update Customer Details
   */
  async updateCustomer(id: string, data: any, username = 'admin') {
    const customer = await this.findCustomerDoc(id);
    if (!customer) {
      throw new AppError('Customer not found.', 404);
    }

    const { name, phone, email, address, notes } = data;
    const updateFields: any = {};

    if (name !== undefined) {
      const cleanName = name.trim();
      if (!cleanName) throw new AppError('Customer name cannot be empty.', 400);
      updateFields.name = cleanName;
    }

    if (phone !== undefined) {
      const cleanPhone = phone.trim();
      if (!cleanPhone) throw new AppError('Phone number cannot be empty.', 400);

      // Check conflict with another customer
      const duplicate = await Customer.findOne({
        _id: { $ne: customer._id },
        phone: cleanPhone,
      }).lean();

      if (duplicate) {
        throw new AppError(`Phone number '${cleanPhone}' is already registered to another customer.`, 409);
      }
      updateFields.phone = cleanPhone;
    }

    if (email !== undefined) {
      updateFields.email = email ? email.trim().toLowerCase() : '';
    }

    if (address !== undefined) {
      updateFields.address = address ? address.trim() : '';
    }

    if (notes !== undefined) {
      updateFields.notes = notes ? notes.trim() : '';
    }

    const updated = await Customer.findByIdAndUpdate(
      customer._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      throw new AppError('Failed to update customer.', 500);
    }

    db.logAudit('UPDATE_CUSTOMER', username, `Updated customer: ${updated.name} (${updated.phone})`);
    return this.formatCustomer(updated);
  },

  /**
   * 5. Delete Customer Profile
   */
  async deleteCustomer(id: string, username = 'admin') {
    const customer = await this.findCustomerDoc(id);
    if (!customer) {
      throw new AppError('Customer not found.', 404);
    }

    const customerName = customer.name;
    const customerPhone = customer.phone;

    await Customer.findByIdAndDelete(customer._id).lean();

    db.logAudit('DELETE_CUSTOMER', username, `Deleted customer profile: ${customerName} (${customerPhone})`);
    return {
      id: customer._id.toString(),
      name: customerName,
      phone: customerPhone,
      message: `Customer ${customerName} was successfully deleted.`,
    };
  },

  /**
   * 6. Customer Statistics Summary
   */
  async getCustomerStats() {
    const [totalCustomers, repeatCustomers, spendAgg] = await Promise.all([
      Customer.countDocuments(),
      Customer.countDocuments({ totalOrders: { $gt: 1 } }),
      Customer.aggregate([
        {
          $group: {
            _id: null,
            totalSpent: { $sum: '$totalSpent' },
            avgSpent: { $avg: '$totalSpent' },
            totalOrders: { $sum: '$totalOrders' },
          },
        },
      ]),
    ]);

    const statsData = spendAgg[0] || { totalSpent: 0, avgSpent: 0, totalOrders: 0 };

    return {
      totalCustomers,
      repeatCustomers,
      newCustomers: Math.max(0, totalCustomers - repeatCustomers),
      totalRevenueFromCustomers: statsData.totalSpent,
      averageSpendPerCustomer: Math.round(statsData.avgSpent || 0),
      totalOrdersPlaced: statsData.totalOrders,
    };
  },

  /**
   * 7. Atomic order recording & customer upsert (invoked on order placement)
   */
  async recordOrderForCustomer(data: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    orderTotal: number;
  }) {
    const cleanPhone = data.phone.trim();
    const cleanName = data.name.trim();

    const updated = await Customer.findOneAndUpdate(
      {
        $or: [{ phone: cleanPhone }, { phone: cleanPhone.replace(/\D/g, '') }],
      },
      {
        $setOnInsert: {
          name: cleanName,
          phone: cleanPhone,
          address: data.address ? data.address.trim() : '',
          createdAt: new Date(),
        },
        $set: {
          lastOrderDate: new Date(),
          ...(data.email ? { email: data.email.trim().toLowerCase() } : {}),
        },
        $inc: {
          totalOrders: 1,
          totalSpent: data.orderTotal,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return this.formatCustomer(updated);
  },
};
