import { NextRequest } from 'next/server';
import { apiJson, withApiHandler } from '@/lib/errors';
import { partyService } from '@/services/party.service';

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const result = await partyService.createInquiry(body);
  return apiJson(
    req,
    {
      success: true,
      inquiryId: result.inquiryId,
      message:
        'Your party and banquet inquiry has been logged! Our banquet coordinator will contact you promptly.',
      inquiry: result.inquiry,
    },
    201
  );
});
