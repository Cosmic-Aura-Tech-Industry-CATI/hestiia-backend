import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { invoicesService } from '@/services/invoices.service';

export const GET = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ identifier: string }> }) => {
    await requireAuth(req);
    const { identifier } = await context.params;
    const result = await invoicesService.getInvoiceDetails(identifier);
    return apiJson(req, { success: true, ...result });
  }
);
