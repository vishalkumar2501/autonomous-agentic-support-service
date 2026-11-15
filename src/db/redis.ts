import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Lazy Redis client: does not crash on startup if Redis is not yet connected during local dev/tests
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Connected to Redis server.');
});

redis.on('error', (err) => {
  logger.warn(`Redis connection warning: ${err.message}`);
});

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('Redis disconnected gracefully.');
  } catch (err) {
    logger.warn('Redis forced disconnect.');
    redis.disconnect();
  }
}

// Cache helper with TTL for order details and idempotency
export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err }, `Failed to set Redis cache for key ${key}`);
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (err) {
      logger.warn({ err }, `Failed to delete Redis cache for key ${key}`);
    }
  },
};
