import { Response } from 'express';

export function sendSuccess(res: Response, data: any = {}, statusCode = 200, message?: string) {
  return res.status(statusCode).json({
    success: true,
    ...(message ? { message } : {}),
    ...data,
  });
}

export function sendCreated(res: Response, data: any = {}, message = 'Created successfully') {
  return sendSuccess(res, data, 201, message);
}
