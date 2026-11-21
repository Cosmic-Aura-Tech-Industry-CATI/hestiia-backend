import { db } from '../../shared/config/store.js';
import { logger } from '../../config/logger.js';

export const contactService = {
  async getStatus() {
    return { module: 'contact', status: 'operational', timestamp: new Date().toISOString() };
  },
};

export default contactService;
