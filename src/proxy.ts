import { NextRequest, NextResponse } from 'next/server';
import { ALLOWED_ORIGINS, NODE_ENV } from '@/lib/env';
import { getCorsHeaders } from '@/lib/errors';

/**
 * Handle CORS preflight (OPTIONS) and origin validation for all /api/* routes.
 */
export function proxy(req: NextRequest) {
  const origin = req.headers.get('origin');

  if (
    origin &&
    NODE_ENV === 'production' &&
    !ALLOWED_ORIGINS.includes(origin)
  ) {
    return NextResponse.json(
      { success: false, message: 'Not allowed by CORS policy.' },
      { status: 403 }
    );
  }

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
  }

  const res = NextResponse.next();
  const corsHeaders = getCorsHeaders(req);
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.headers.set(key, value);
  }
  return res;
}

export const config = {
  matcher: '/api/:path*',
};
