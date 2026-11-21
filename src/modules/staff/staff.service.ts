import { db } from '../../shared/config/store.js';
import { logger } from '../../config/logger.js';

export const staffService = {
  async getStatus() {
    return { module: 'staff', status: 'operational', timestamp: new Date().toISOString() };
  },
};

export default staffService;
