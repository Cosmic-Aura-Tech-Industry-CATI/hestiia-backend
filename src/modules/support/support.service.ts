import { db } from '../../shared/config/store.js';
import { logger } from '../../config/logger.js';

export const supportService = {
  async getStatus() {
    return { module: 'support', status: 'operational', timestamp: new Date().toISOString() };
  },
};

export default supportService;
