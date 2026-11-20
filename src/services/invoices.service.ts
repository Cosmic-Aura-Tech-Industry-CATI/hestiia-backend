import { AppError } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';
import { escapeRegex } from '@/lib/regex';
import { IInvoice, InvoiceModel } from '@/models/Invoice.model';
import { settingsService } from './settings.service';
import { cleanDoc, cleanDocs } from '@/models/_schema';

export const invoicesService = {
  async getInvoices(query: any) {
    await connectDB();
    const { search, page = '1', limit = '20' } = query;

    const filter: Record<string, any> = {};
    if (search) {
      const rx = new RegExp(escapeRegex(String(search)), 'i');
      filter.$or = [
        { invoiceNumber: rx },
        { orderNumber: rx },
        { customerName: rx },
        { customerPhone: rx },
      ];
    }

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [total, rawInvoices] = await Promise.all([
      InvoiceModel.countDocuments(filter),
      InvoiceModel.find(filter).sort({ issuedAt: -1 }).skip(skip).limit(limitNum).lean(),
    ]);

    return {
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      invoices: cleanDocs<IInvoice>(rawInvoices),
    };
  },

  async getInvoiceDetails(identifier: string) {
    await connectDB();
    const rx = new RegExp(`^${escapeRegex(identifier)}$`, 'i');
    const [invoiceDoc, restaurant] = await Promise.all([
      InvoiceModel.findOne({
        $or: [{ id: identifier }, { invoiceNumber: rx }, { orderNumber: rx }],
      }).lean(),
      settingsService.getAdminSettings(),
    ]);

    if (!invoiceDoc) {
      throw new AppError('Invoice not found.', 404);
    }

    return {
      invoice: cleanDoc<IInvoice>(invoiceDoc),
      restaurant,
    };
  },
};
