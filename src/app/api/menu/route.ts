import { NextRequest } from 'next/server';
import { apiJson, withApiHandler } from '@/lib/errors';
import { menuService } from '@/services/menu.service';

export const GET = withApiHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const result = await menuService.getPublicMenu({
    category: sp.get('category') || undefined,
    isVeg: sp.get('isVeg') ?? undefined,
    search: sp.get('search') || undefined,
    availableOnly: sp.get('availableOnly') ?? undefined,
  });
  return apiJson(req, { success: true, ...result });
});
