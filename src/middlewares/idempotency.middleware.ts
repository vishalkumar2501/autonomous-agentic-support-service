import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../db/redis';
import { logger } from '../config/logger';

interface CachedResponse {
  statusCode: number;
  body: unknown;
}

// WHY: Guarantee safe at-most-once execution for mutating POST operations if clients retry requests.
export const idempotencyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

  // Only apply to mutating requests with an Idempotency-Key header
  if (!idempotencyKey || req.method !== 'POST') {
    next();
    return;
  }

  const userId = req.user?.id || 'anonymous';
  const cacheKey = `idempotency:${userId}:${idempotencyKey}`;

  try {
    const cached = await cacheService.get<CachedResponse>(cacheKey);

    if (cached) {
      logger.info({ cacheKey, idempotencyKey }, 'Returning cached idempotent response');
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Idempotent-Replay', 'true');
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    // Intercept res.json to capture response payload
    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      // Restore original res.json
      res.json = originalJson;

      // Only cache successful or accepted operations (200-299)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Cache for 24 hours (86400 seconds)
        cacheService
          .set(cacheKey, { statusCode: res.statusCode, body }, 86400)
          .catch((err) => {
            logger.error({ err, cacheKey }, 'Failed to save idempotent response to cache');
          });
      }

      return originalJson(body);
    };

    next();
  } catch (err) {
    logger.error({ err, cacheKey }, 'Error evaluating idempotency cache');
    next();
  }
};
