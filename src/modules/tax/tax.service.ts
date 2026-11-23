import { db } from '../../shared/config/store.js';
import { logger } from '../../config/logger.js';

export const taxService = {
  async getStatus() {
    return { module: 'tax', status: 'operational', timestamp: new Date().toISOString() };
  },
};

export default taxService;
