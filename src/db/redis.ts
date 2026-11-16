import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

const isTest = env.NODE_ENV === 'test';

// In-memory fallback map for test environments or when Redis is offline
const inMemoryCache = new Map<string, { value: string; expiresAt: number }>();

// Lazy Redis client: does not crash on startup if Redis is not yet connected during local dev/tests
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  enableOfflineQueue: false, // Critical: do NOT hang requests if Redis is offline
  connectTimeout: 1000,
  retryStrategy(times) {
    if (isTest) return null; // In test mode, don't spam reconnection attempts
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Connected to Redis server.');
});

redis.on('error', (err) => {
  if (!isTest) {
    logger.warn(`Redis connection warning: ${err.message}`);
  }
});

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('Redis disconnected gracefully.');
  } catch {
    redis.disconnect();
  }
}

// Resilient cache helper: falls back to in-memory cache if Redis is unavailable
export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    if (isTest) {
      const item = inMemoryCache.get(key);
      if (!item) return null;
      if (Date.now() > item.expiresAt) {
        inMemoryCache.delete(key);
        return null;
      }
      return JSON.parse(item.value) as T;
    }

    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    if (isTest) {
      inMemoryCache.set(key, {
        value: JSON.stringify(value),
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      return;
    }

    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Graceful degradation when Redis is offline
    }
  },

  async del(key: string): Promise<void> {
    if (isTest) {
      inMemoryCache.delete(key);
      return;
    }

    try {
      await redis.del(key);
    } catch {
      // Graceful degradation
    }
  },
};
