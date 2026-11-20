import { NextRequest } from 'next/server';
import { apiJson, withApiHandler } from '@/lib/errors';
import { ordersService } from '@/services/orders.service';

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const { order, invoice } = await ordersService.createOrder(body);
  return apiJson(
    req,
    {
      success: true,
      message: 'Your order has been received and sent to Hestiia kitchen!',
      order,
      invoice,
    },
    201
  );
});
