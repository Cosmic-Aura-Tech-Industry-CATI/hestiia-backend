import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiJson, withApiHandler } from '@/lib/errors';
import { partyService } from '@/services/party.service';

export const PATCH = withApiHandler(
  async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    const actor = user.name || user.username || 'Staff';
    const inquiry = await partyService.updateInquiryStatus(id, body, actor);
    return apiJson(req, {
      success: true,
      inquiry,
      message: 'Party inquiry updated successfully.',
    });
  }
);
