import { db } from '../../shared/config/store.js';

export const restaurantService = {
  async getInfo() {
    return db.getState().settings;
  },
  async updateInfo(updates: any, username = 'admin') {
    let updated: any = null;
    db.updateState((s) => {
      s.settings = { ...s.settings, ...updates };
      updated = s.settings;
    });
    db.logAudit('UPDATE_RESTAURANT_INFO', username, 'Updated restaurant details');
    return updated;
  },
};

export default restaurantService;
