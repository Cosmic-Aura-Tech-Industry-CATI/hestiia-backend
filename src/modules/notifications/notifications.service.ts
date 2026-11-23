import { db } from '../../shared/config/store.js';
import { emailService } from '../../infrastructure/email/emailService.js';
import { smsService } from '../../infrastructure/sms/smsService.js';
import { broadcast } from '../../sockets/socketServer.js';

export const notificationsService = {
  async notifyOrderCreated(order: any) {
    await emailService.sendAdminOrderAlert(order);
    await smsService.sendOrderSMS(order.customerPhone, `Your Hestiia order #${order.orderNumber} is confirmed!`);
    broadcast('room:kds:kitchen', 'order:new', order);
    broadcast('room:admin:overview', 'order:new', order);
  },
  async notifyBookingCreated(booking: any) {
    await emailService.sendBookingConfirmation(booking);
    broadcast('room:admin:bookings', 'booking:new', booking);
  },
};

export default notificationsService;
