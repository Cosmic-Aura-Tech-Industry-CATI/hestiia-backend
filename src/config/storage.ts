import { ENV } from './env.js';

export const storageConfig = {
  driver: process.env.STORAGE_DRIVER || 'local',
  localDir: ENV.UPLOADS_DIR,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
};

export default storageConfig;
