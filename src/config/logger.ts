import pino from 'pino';

// Redact sensitive keys so passwords, secrets, and auth tokens are never leaked into logs
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'DATABASE_URL',
  'GOOGLE_API_KEY',
  'OPENAI_API_KEY',
  '*.password',
  '*.passwordHash',
];

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    !isProduction && process.env.NODE_ENV !== 'test'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
});
