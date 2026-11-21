import { db } from '../../shared/config/store.js';
import { logger } from '../../config/logger.js';

export const eventsService = {
  async getStatus() {
    return { module: 'events', status: 'operational', timestamp: new Date().toISOString() };
  },
};

export default eventsService;
