import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { createAgentWorker } from './queues/agent.worker';
import { Worker } from 'bullmq';

const app = createApp();

let embeddedWorker: Worker | null = null;
if (env.RUN_WORKER_IN_PROCESS) {
  logger.info('Initializing embedded BullMQ Agent Worker inside API process...');
  embeddedWorker = createAgentWorker();
}

const server = app.listen(env.PORT, () => {
  logger.info(`API Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
});

// Graceful shutdown handling for ECS / Docker SIGTERM
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (embeddedWorker) {
    logger.info('Closing embedded BullMQ worker...');
    await embeddedWorker.close().catch((err) => logger.error({ err }, 'Error closing worker'));
  }
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if connections refuse to close
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
