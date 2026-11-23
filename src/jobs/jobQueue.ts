import { logger } from '../config/logger.js';

export const jobQueue = {
  dispatch: async (jobName: string, data: any) => {
    logger.info(`[JobQueue Dispatch] Running job: ${jobName}`);
    setTimeout(() => {
      try {
        if (jobName === 'SEND_ADMIN_EMAIL_ALERT') {
          logger.info(`[Job Executed] Alert sent for #${data.orderNumber || data.bookingRef}`);
        }
      } catch (err: any) {
        logger.error(`[Job Error] ${jobName}: ${err?.message}`);
      }
    }, 50);
  },
};

export default jobQueue;
