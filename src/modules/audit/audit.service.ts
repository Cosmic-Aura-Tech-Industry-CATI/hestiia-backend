import { db } from '../../shared/config/store.js';
import { logger } from '../../config/logger.js';

export const auditService = {
  async getStatus() {
    return { module: 'audit', status: 'operational', timestamp: new Date().toISOString() };
  },
};

export default auditService;
