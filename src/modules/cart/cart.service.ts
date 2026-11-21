import { db } from '../../shared/config/store.js';
import { logger } from '../../config/logger.js';

export const cartService = {
  async getStatus() {
    return { module: 'cart', status: 'operational', timestamp: new Date().toISOString() };
  },
};

export default cartService;
