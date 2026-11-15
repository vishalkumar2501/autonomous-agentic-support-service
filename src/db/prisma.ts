import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Append connection_limit parameter if not already in URL to prevent connection pool exhaustion
function getDatabaseUrlWithPool(): string {
  const url = env.DATABASE_URL;
  const separator = url.includes('?') ? '&' : '?';
  if (!url.includes('connection_limit=')) {
    return `${url}${separator}connection_limit=${env.DB_POOL_MAX}`;
  }
  return url;
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrlWithPool(),
      },
    },
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });

if (env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    logger.debug({ duration: `${e.duration}ms` }, `Prisma Query: ${e.query}`);
  });
}

prisma.$on('error' as never, (e: { message: string }) => {
  logger.error(`Prisma Error: ${e.message}`);
});

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Prisma disconnected gracefully.');
}
