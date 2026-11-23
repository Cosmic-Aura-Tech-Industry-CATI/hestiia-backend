import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/index.js';
import { logger } from '../config/logger.js';
import { ENV } from '../config/env.js';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) {
    return _next(err);
  }

  // 1. Normalize Status Code: Must be a valid HTTP status between 400 and 599
  let statusCode = 500;
  if (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode <= 599) {
    statusCode = err.statusCode;
  } else if (typeof err.status === 'number' && err.status >= 400 && err.status <= 599) {
    statusCode = err.status;
  }

  let message = err.message || 'An unexpected internal server error occurred.';

  // 2. Mongoose CastError (Invalid ID / malformed resource identifier)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid resource identifier for ${err.path || 'id'}: '${err.value}'.`;
  }

  // 3. Mongoose Duplicate Key Error (11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field} already exists. Please use a unique value.`;
  }

  // 4. Mongoose ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e: any) => e.message);
    message = `Validation failed: ${errors.join(', ')}`;
  }

  // 5. JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please log in again.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication session has expired. Please log in again.';
  }

  // 6. JSON Syntax Error in request body
  if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON payload in request body.';
  }

  // 7. Fallback sanity check: Never allow 200 or out-of-range status codes in error response
  if (statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  logger.error(`[${req.method} ${req.originalUrl}] Status ${statusCode}: ${message}`);
  if (statusCode === 500 && err.stack) {
    logger.error(err.stack);
  }

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(err.details ? { details: err.details } : {}),
    ...(ENV.NODE_ENV === 'development' && statusCode === 500 && err.stack ? { stack: err.stack } : {}),
  });
}

export default errorHandler;
