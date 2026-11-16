import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import { v4 as uuidv4 } from 'uuid';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middlewares/error.middleware';
import { ApiError } from './utils/ApiError';
import { authRouter } from './modules/auth/auth.routes';

export const createApp = (): express.Application => {
  const app = express();

  // Behind ALB/Reverse proxy, trust proxy for accurate client IPs and rate limiting
  app.set('trust proxy', env.TRUST_PROXY);

  // Security headers
  app.use(helmet());

  // CORS configuration
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new ApiError(403, 'CORS origin not allowed'));
        }
      },
      credentials: true,
    }),
  );

  // Prevent HTTP parameter pollution attacks
  app.use(hpp());

  // Body parsers
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Attach unique Request ID to every request for end-to-end tracing
  app.use((req: Request, res: Response, next: NextFunction) => {
    const reqId = (req.headers['x-request-id'] as string) || uuidv4();
    req.headers['x-request-id'] = reqId;
    res.setHeader('x-request-id', reqId);
    next();
  });

  // HTTP Request logger
  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => (req.headers['x-request-id'] as string) || uuidv4(),
        customLogLevel: (res, err) => {
          const code = res.statusCode ?? 200;
          if (code >= 500 || err) return 'error';
          if (code >= 400) return 'warn';
          return 'info';
        },
      }),
    );
  }

  // Health check endpoint (Liveness)
  const healthHandler = (_req: Request, res: Response): void => {
    res.status(200).json({
      status: 'ok',
      service: 'autonomous-agentic-support-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
    });
  };

  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  // Mount API Modules
  app.use('/api/v1/auth', authRouter);

  // Readiness probe: verifies DB health for ECS/ALB routing
  app.get('/api/v1/ready', async (_req: Request, res: Response) => {
    try {
      const { prisma } = await import('./db/prisma');
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: 'ready',
        checks: {
          database: 'ok',
        },
      });
    } catch (err) {
      res.status(503).json({
        status: 'unready',
        error: 'Database check failed',
      });
    }
  });

  // Handle 404 for undefined routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
  });

  // Central error handling middleware
  app.use(errorHandler);

  return app;
};
