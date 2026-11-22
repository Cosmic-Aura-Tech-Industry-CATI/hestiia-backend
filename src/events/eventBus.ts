import { EventEmitter } from 'events';
import { logger } from '../config/logger.js';

export const DOMAIN_EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_CANCELLED: 'order.cancelled',
  PAYMENT_INTENT_CREATED: 'payment.intent_created',
  PAYMENT_PAID: 'payment.paid',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  PAYMENT_UPI_SUBMITTED: 'payment.upi_submitted',
  PAYMENT_UPI_VERIFIED: 'payment.upi_verified',
} as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export class DomainEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emitEvent(eventName: string, payload: any) {
    logger.info(`[DomainEvent] ${eventName}`, {
      orderId: payload?.order?.id || payload?.orderId || payload?.payment?.orderId,
      orderNumber: payload?.order?.orderNumber || payload?.orderNumber || payload?.payment?.orderNumber,
    });
    return this.emit(eventName, payload);
  }
}

export const eventBus = new DomainEventBus();
export default eventBus;
