import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { customersService } from '@/services/customers.service';

export const GET = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await context.params;
    const result = await customersService.getCustomerById(id);
    return apiJson(req, { success: true, ...result });
  }
);
