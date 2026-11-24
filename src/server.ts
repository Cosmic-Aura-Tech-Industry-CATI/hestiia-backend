import http from 'http';
import { execSync } from 'child_process';
import { app } from './app.js';
import { ENV } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { initializeSockets } from './sockets/socketServer.js';
import { logger } from './config/logger.js';
import { authService } from './modules/auth/auth.service.js';

const httpServer = http.createServer(app);
export const io = initializeSockets(httpServer);

/**
 * Frees port by terminating lingering processes in development mode
 */
function freePort(port: number | string): boolean {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const pids = new Set<string>();
      for (const line of output.trim().split('\n')) {
        if (/LISTENING/i.test(line)) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0' && pid !== String(process.pid)) {
            pids.add(pid);
          }
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        } catch {
          // Process might have already terminated
        }
      }
      return pids.size > 0;
    } else {
      execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
      return true;
    }
  } catch {
    return false;
  }
}

function logBanner() {
  logger.info('=======================================================');
  logger.info('🍽️  HESTIIA RESTAURANT PLATFORM (MODULAR MONOLITH V1.0)');
  logger.info(`🚀 HTTP & Socket.IO server running on http://localhost:${ENV.PORT}`);
  logger.info(`🛡️  Healthcheck ready at: http://localhost:${ENV.PORT}/api/v1/health`);
  logger.info('=======================================================');
}

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
    let retried = false;

    const onError = (err: any) => {
      if (err.code === 'EADDRINUSE' && !retried && ENV.NODE_ENV !== 'production') {
        retried = true;
        logger.warn(`[Server] Port ${ENV.PORT} already in use. Auto-clearing lingering process and retrying...`);
        const freed = freePort(ENV.PORT);
        setTimeout(() => {
          httpServer.once('error', (retryErr: any) => {
            logger.error(`Port ${ENV.PORT} still in use after auto-clear.`, retryErr);
            reject(retryErr);
          });
          httpServer.listen(ENV.PORT, () => {
            logBanner();
            resolve(httpServer);
          });
        }, freed ? 800 : 300);
        return;
      }

      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${ENV.PORT} already in use. Terminate existing process or set different PORT in .env.`);
      } else {
        logger.error('HTTP server error:', err);
      }
      reject(err);
    };

    httpServer.once('error', onError);

    const server = httpServer.listen(ENV.PORT, () => {
      logBanner();
      resolve(server);
    });
  });
}

// Graceful termination handlers
process.on('SIGINT', () => {
  httpServer.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  httpServer.close(() => {
    process.exit(0);
  });
});

if (ENV.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    logger.error('Fatal error starting server:', err);
  });
}

export default app;
