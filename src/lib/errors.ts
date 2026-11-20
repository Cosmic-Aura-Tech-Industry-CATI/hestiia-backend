import { NextRequest, NextResponse } from 'next/server';
import { ALLOWED_ORIGINS, NODE_ENV } from './env';

/**
 * Operational application error with HTTP status code.
 */
export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Build CORS response headers matching the incoming origin against ALLOWED_ORIGINS in production.
 */
export function getCorsHeaders(req?: NextRequest): Record<string, string> {
  const origin = req?.headers.get('origin') || '';
  const allowOrigin =
    !origin || NODE_ENV !== 'production' || ALLOWED_ORIGINS.includes(origin)
      ? origin || '*'
      : '';

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };

  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
    if (allowOrigin !== '*') {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  }

  return headers;
}

/**
 * Return a standardized JSON response with CORS headers attached.
 */
export function apiJson(
  req: NextRequest,
  body: Record<string, any>,
  status = 200
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: getCorsHeaders(req),
  });
}

/**
 * Map operational, Mongoose, and JWT errors to consistent HTTP JSON responses.
 */
export function handleApiError(req: NextRequest, err: any): NextResponse {
  let statusCode = err?.statusCode || err?.status || 500;
  let message = err?.message || 'An unexpected internal server error occurred.';

  if (err?.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}: ${err.value}.`;
  } else if (err?.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field} already exists. Please use a unique value.`;
  } else if (err?.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e: any) => e.message);
    message = `Validation failed: ${errors.join(', ')}`;
  } else if (err?.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please log in again.';
  } else if (err?.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication session has expired. Please log in again.';
  }

  if (NODE_ENV === 'development' && statusCode === 500) {
    console.error('[API Error]', err);
  }

  return apiJson(
    req,
    {
      success: false,
      message,
      ...(NODE_ENV === 'development' && err?.stack ? { stack: err.stack } : {}),
    },
    statusCode
  );
}

/**
 * Wrap a Next.js App Router handler with centralized error handling.
 */
export function withApiHandler<TContext = any>(
  handler: (req: NextRequest, context: TContext) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: TContext): Promise<NextResponse> => {
    try {
      return await handler(req, context);
    } catch (err) {
      return handleApiError(req, err);
    }
  };
}
