import { db } from '../../shared/config/store.js';
import { logger } from '../../config/logger.js';

export const usersService = {
  async getStatus() {
    return { module: 'users', status: 'operational', timestamp: new Date().toISOString() };
  },
};

export default usersService;
