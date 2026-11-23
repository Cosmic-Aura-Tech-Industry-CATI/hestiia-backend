import { db } from '../../shared/config/store.js';
import { logger } from '../../config/logger.js';

export const deliveryService = {
  async getStatus() {
    return { module: 'delivery', status: 'operational', timestamp: new Date().toISOString() };
  },
};

export default deliveryService;
