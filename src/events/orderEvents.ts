import { eventBus, DOMAIN_EVENTS } from './eventBus.js';
import { ordersService } from '../modules/orders/orders.service.js';
import { paymentsService } from '../modules/payments/payments.service.js';
import { offersService } from '../modules/offers/services/offers.service.js';
import { broadcast } from '../sockets/socketServer.js';
import { logger } from '../config/logger.js';

let initialized = false;

export function registerOrderAndPaymentEventHandlers() {
  if (initialized) return;
  initialized = true;

  logger.info('[DomainEvents] Registering Order and Payment domain event subscribers');

  // 1. Payment Paid Event -> Advance Order state & Sync Dashboards / KDS
  eventBus.on(DOMAIN_EVENTS.PAYMENT_PAID, async (payload) => {
    try {
      const order = await ordersService.handlePaymentPaidEvent(payload);
      const orderNumber = payload?.payment?.orderNumber || (order ? order.orderNumber : undefined);

      if (orderNumber) {
        broadcast(`room:order:${orderNumber}`, 'order:payment:paid', {
          orderNumber,
          payment: payload.payment,
          orderStatus: order ? order.orderStatus : undefined,
        });
      }

      broadcast('room:admin:orders', 'order:payment:paid', {
        orderNumber,
        payment: payload.payment,
        order,
      });

      broadcast('room:admin:payments', 'payment:received', {
        payment: payload.payment,
      });

      // Notify kitchen display system (KDS) of newly confirmed order ready for prep
      if (order && order.orderStatus === 'confirmed') {
        broadcast('room:kds:kitchen', 'kds:order:new', {
          order,
          timestamp: new Date().toISOString(),
        });
      }

      // Record offer redemption upon verified successful payment
      if (order && (order as any).offer && (order as any).offer.offerId) {
        await offersService.recordRedemption({
          offerId: (order as any).offer.offerId,
          orderId: order.orderNumber || order.id,
          discountAmount: (order as any).offer.discountAmount || order.discountAmount || 0,
          orderSubtotal: order.subtotal || 0,
        });
      }
    } catch (err: any) {
      logger.error(`[DomainEvents Error - PAYMENT_PAID] ${err?.message}`);
    }
  });

  // 2. Payment Failed Event -> Notify Customer & Admin
  eventBus.on(DOMAIN_EVENTS.PAYMENT_FAILED, (payload) => {
    const orderNumber = payload?.payment?.orderNumber || payload?.orderNumber;
    if (orderNumber) {
      broadcast(`room:order:${orderNumber}`, 'order:payment:failed', payload);
    }
    broadcast('room:admin:orders', 'order:payment:failed', payload);
  });

  // 3. Order Created Event -> Broadcast to Admin & Customer room
  eventBus.on(DOMAIN_EVENTS.ORDER_CREATED, (payload) => {
    const orderNumber = payload?.order?.orderNumber;
    if (orderNumber) {
      broadcast(`room:order:${orderNumber}`, 'order:created', payload.order);
    }
    broadcast('room:admin:orders', 'order:created', payload.order);
  });

  // 4. Order Status Changed Event -> Synchronize KDS, Admin, Customer
  eventBus.on(DOMAIN_EVENTS.ORDER_STATUS_CHANGED, (payload) => {
    const orderNumber = payload?.order?.orderNumber;
    if (orderNumber) {
      broadcast(`room:order:${orderNumber}`, 'order:status:updated', {
        order: payload.order,
        status: payload.newStatus,
      });
    }
    broadcast('room:admin:orders', 'order:status:updated', payload);
    broadcast('room:kds:kitchen', 'kds:order:status:updated', payload);
  });

  // 5. Order Cancelled Event -> Auto-refund if paid & alert Kitchen
  eventBus.on(DOMAIN_EVENTS.ORDER_CANCELLED, async (payload) => {
    try {
      const { order, actor, reason } = payload;
      const orderNumber = order?.orderNumber;

      // Auto-trigger refund if already paid
      if (order?.paymentStatus === 'paid') {
        logger.info(`[DomainEvents] Auto-initiating refund for cancelled paid order ${orderNumber}`);
        await paymentsService.processRefund(
          {
            orderId: order.id,
            refundAmount: order.grandTotal,
            reason: `Order cancelled by ${actor}: ${reason}`,
          },
          actor
        );
      }

      if (orderNumber) {
        broadcast(`room:order:${orderNumber}`, 'order:cancelled', { order, reason, actor });
      }
      broadcast('room:admin:orders', 'order:cancelled', { order, reason, actor });
      broadcast('room:kds:kitchen', 'kds:order:cancelled', { orderNumber, reason });
    } catch (err: any) {
      logger.error(`[DomainEvents Error - ORDER_CANCELLED] ${err?.message}`);
    }
  });

  // 6. Manual UPI Submitted -> Notify Admin / Cashier Dashboard
  eventBus.on(DOMAIN_EVENTS.PAYMENT_UPI_SUBMITTED, (payload) => {
    broadcast('room:admin:payments', 'payment:upi:pending', payload);
    broadcast('room:admin:orders', 'order:upi:pending', {
      orderNumber: payload?.payment?.orderNumber,
      upiUtr: payload?.upiUtr,
    });
  });

  // 7. Payment Refunded -> Notify Customer & Admin
  eventBus.on(DOMAIN_EVENTS.PAYMENT_REFUNDED, (payload) => {
    const orderNumber = payload?.payment?.orderNumber;
    if (orderNumber) {
      broadcast(`room:order:${orderNumber}`, 'order:payment:refunded', payload);
    }
    broadcast('room:admin:payments', 'payment:refunded', payload);
    broadcast('room:admin:orders', 'order:payment:refunded', payload);
  });
}

// Auto-register on import
registerOrderAndPaymentEventHandlers();
