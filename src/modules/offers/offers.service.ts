import { db } from '../../shared/config/store.js';
import { logger } from '../../config/logger.js';

export const offersService = {
  async getStatus() {
    return { module: 'offers', status: 'operational', timestamp: new Date().toISOString() };
  },
};

export default offersService;
