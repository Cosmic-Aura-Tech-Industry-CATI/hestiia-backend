import { logger } from '../../config/logger.js';

export const smsService = {
  async sendOrderSMS(phone: string, message: string) {
    logger.info(`[SMS Service] Dispatched SMS to ${phone}: ${message}`);
    return true;
  },
};
