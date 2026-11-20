import { NextRequest } from 'next/server';
import { apiJson, withApiHandler } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';

export const GET = withApiHandler(async (req: NextRequest) => {
  await connectDB();
  return apiJson(req, {
    status: 'healthy',
    system: 'DIMISI Restaurant Management Platform',
    restaurant: 'HESTIIA RESTAURANT',
    architecture: 'DIMISI-OPS Next.js App Router + MongoDB + Cloudinary',
    timestamp: new Date().toISOString(),
  });
});
