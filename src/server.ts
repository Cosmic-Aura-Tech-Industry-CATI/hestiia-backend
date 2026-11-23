import http from 'http';
import { app } from './app.js';
import { ENV } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { initializeSockets } from './sockets/socketServer.js';
import { logger } from './config/logger.js';
import { authService } from './modules/auth/auth.service.js';

const httpServer = http.createServer(app);
export const io = initializeSockets(httpServer);

export async function startServer() {
  await connectDatabase();

  if (typeof authService.bootstrapSuperadmin === 'function') {
    try {
      await authService.bootstrapSuperadmin();
    } catch (err: any) {
      logger.warn(`[Bootstrap] Superadmin bootstrap bypassed: ${err?.message}`);
    }
  }

  return new Promise((resolve, reject) => {
    httpServer.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${ENV.PORT} already in use. Terminate existing process or set different PORT in .env.`);
      } else {
        logger.error('HTTP server error:', err);
      }
      reject(err);
    });

    const server = httpServer.listen(ENV.PORT, () => {
      logger.info('=======================================================');
      logger.info('🍽️  HESTIIA RESTAURANT PLATFORM (MODULAR MONOLITH V1.0)');
      logger.info(`🚀 HTTP & Socket.IO server running on http://localhost:${ENV.PORT}`);
      logger.info(`🛡️  Healthcheck ready at: http://localhost:${ENV.PORT}/api/v1/health`);
      logger.info('=======================================================');
      resolve(server);
    });
  });
}

if (ENV.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.error('Fatal error starting server:', err);
  });
}

export default app;
