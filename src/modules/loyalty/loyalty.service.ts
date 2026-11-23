import { db } from '../../shared/config/store.js';
import { logger } from '../../config/logger.js';

export const loyaltyService = {
  async getStatus() {
    return { module: 'loyalty', status: 'operational', timestamp: new Date().toISOString() };
  },
};

export default loyaltyService;
