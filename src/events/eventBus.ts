import { EventEmitter } from 'events';
import { logger } from '../config/logger.js';

export class DomainEventBus extends EventEmitter {
  emitEvent(eventName: string, payload: any) {
    logger.info(`[DomainEvent] ${eventName}`);
    return this.emit(eventName, payload);
  }
}

export const eventBus = new DomainEventBus();
export default eventBus;
