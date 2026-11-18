import { createAgentWorker } from './queues/agent.worker';
import { disconnectPrisma } from './db/prisma';
import { disconnectRedis } from './db/redis';
import { logger } from './config/logger';

logger.info('Starting BullMQ Agent Worker Process...');

const worker = createAgentWorker();

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down worker process...`);
  try {
    await worker.close();
    await disconnectPrisma();
    await disconnectRedis();
    logger.info('Worker shutdown completed.');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during worker shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
