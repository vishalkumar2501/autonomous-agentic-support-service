import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';

// Central error handler ensures uniform JSON error structure and prevents secret leakage
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  // Handle known ApiError
  if (err instanceof ApiError) {
    logger.warn({ err, requestId }, `ApiError [${err.statusCode}]: ${err.message}`);
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        statusCode: err.statusCode,
        details: err.details,
        requestId,
      },
    });
    return;
  }

  // Handle Zod schema validation errors
  if (err instanceof ZodError) {
    logger.warn({ err: err.issues, requestId }, 'Validation Error');
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        statusCode: 400,
        details: err.flatten(),
        requestId,
      },
    });
    return;
  }

  // Handle unexpected internal server errors
  logger.error({ err, requestId }, `Unhandled Error: ${err.message}`);
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      statusCode: 500,
      requestId,
    },
  });
};
