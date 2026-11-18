import { logger } from '../config/logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  timeoutMs?: number;
}

// Retries async operation with exponential backoff and timeout
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const initialDelay = options.initialDelayMs ?? 500;
  const backoffFactor = options.backoffFactor ?? 2;
  const timeoutMs = options.timeoutMs ?? 30000;

  let attempt = 0;
  let delay = initialDelay;

  while (attempt <= maxRetries) {
    try {
      // Enforce timeout using Promise.race
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const result = await Promise.race([
        fn().finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
        }),
        timeoutPromise,
      ]);

      return result;
    } catch (error) {
      attempt++;
      if (attempt > maxRetries) {
        logger.error({ error, attempt }, `Retry exhausted after ${maxRetries} attempts`);
        throw error;
      }

      logger.warn(
        { attempt, delay, err: (error as Error).message },
        `Operation failed. Retrying in ${delay}ms...`,
      );

      await new Promise((res) => setTimeout(res, delay));
      delay *= backoffFactor;
    }
  }

  throw new Error('Retry loop exited unexpectedly');
}
