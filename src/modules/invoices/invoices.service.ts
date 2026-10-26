import { db } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';

export const invoicesService = {
  async getInvoices(query: any) {
    const { search, page = '1', limit = '20' } = query;
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

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = invoices.slice(startIndex, startIndex + limitNum);

    return {
      total: invoices.length,
      page: pageNum,
      totalPages: Math.ceil(invoices.length / limitNum),
      invoices: paginated,
    };
  },

  async getInvoiceDetails(identifier: string) {
    const state = db.getState();
    const invoice = state.invoices.find(
      (i) => i.id === identifier || i.invoiceNumber.toLowerCase() === identifier.toLowerCase() || i.orderNumber.toLowerCase() === identifier.toLowerCase()
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
