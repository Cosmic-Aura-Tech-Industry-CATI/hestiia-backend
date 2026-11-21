import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/index.js';
import { logger } from '../config/logger.js';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  logger.error(`[${req.method} ${req.originalUrl}] ${err.message}`);

  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  res.status(err.statusCode).json({
    success: false,
    message: err.message || 'An internal system error occurred. Please contact front desk.',
  });
}

export default errorHandler;
