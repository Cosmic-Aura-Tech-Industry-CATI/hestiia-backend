import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError.js';
import { NODE_ENV } from '../config/utils.js';

export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'An unexpected internal server error occurred.';

  // Mongoose CastError (Invalid ID)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}: ${err.value}.`;
  }

  // Mongoose Duplicate Key Error (11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field} already exists. Please use a unique value.`;
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e: any) => e.message);
    message = `Validation failed: ${errors.join(', ')}`;
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please log in again.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication session has expired. Please log in again.';
  }

  if (NODE_ENV === 'development' && statusCode === 500) {
    console.error('[Global Error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {}),
  });
};

export default globalErrorHandler;
