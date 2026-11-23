import { logger } from '../../config/logger.js';

export const emailService = {
  async sendAdminOrderAlert(order: any) {
    logger.info(`[Email Service] Dispatched Admin Alert for order ${order.orderNumber}`);
    return true;
  },
  async sendBookingConfirmation(booking: any) {
    logger.info(`[Email Service] Dispatched Table Booking Notification for ${booking.bookingRef || booking.id}`);
    return true;
  },
};
