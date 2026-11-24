import mongoose from 'mongoose';
import { db } from '../../shared/config/db.js';
import { Invoice } from './invoice.model.js';
import { AppError } from '../../shared/utils/appError.js';

export const invoicesService = {
  async getInvoices(query: any) {
    const { search, page = '1', limit = '20' } = query;
    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;

    // 1. Direct MongoDB Atlas Query
    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (search && String(search).trim()) {
          const q = String(search).trim();
          filter.$or = [
            { invoiceNumber: { $regex: q, $options: 'i' } },
            { orderNumber: { $regex: q, $options: 'i' } },
            { customerName: { $regex: q, $options: 'i' } },
            { customerPhone: { $regex: q, $options: 'i' } },
          ];
        }

        const [total, invoices] = await Promise.all([
          Invoice.countDocuments(filter),
          Invoice.find(filter)
            .sort({ issuedAt: -1, createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
        ]);

        if (total > 0 || !search) {
          return {
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum) || 1,
            invoices,
          };
        }
      } catch {
        // Fallback to local store
      }
    }

    // 2. Resilient Fallback to In-Memory Store
    let invoices = [...db.getState().invoices];

    if (search) {
      const q = String(search).toLowerCase();
      invoices = invoices.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.orderNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          i.customerPhone.includes(q)
      );
    }

    invoices.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

    const startIndex = (pageNum - 1) * limitNum;
    const paginated = invoices.slice(startIndex, startIndex + limitNum);

    return {
      total: invoices.length,
      page: pageNum,
      totalPages: Math.ceil(invoices.length / limitNum) || 1,
      invoices: paginated,
    };
  },

  async getInvoiceDetails(identifier: string) {
    const state = db.getState();

    // 1. Try MongoDB Atlas First
    if (mongoose.connection.readyState === 1) {
      try {
        const queryOr: any[] = [
          { invoiceNumber: new RegExp(`^${identifier.trim()}$`, 'i') },
          { orderNumber: new RegExp(`^${identifier.trim()}$`, 'i') },
        ];
        if (mongoose.Types.ObjectId.isValid(identifier)) {
          queryOr.unshift({ _id: identifier });
        }

        const dbInvoice = await Invoice.findOne({ $or: queryOr }).lean();
        if (dbInvoice) {
          return {
            invoice: dbInvoice,
            restaurant: state.settings,
          };
        }
      } catch {
        // Fallback to store
      }
    }

    // 2. Fallback to Store
    const invoice = state.invoices.find(
      (i) =>
        i.id === identifier ||
        i.invoiceNumber.toLowerCase() === identifier.toLowerCase() ||
        i.orderNumber.toLowerCase() === identifier.toLowerCase()
    );

    if (!invoice) {
      throw new AppError('Invoice not found.', 404);
    }

    return {
      invoice,
      restaurant: state.settings,
    };
  },
};

export default invoicesService;
