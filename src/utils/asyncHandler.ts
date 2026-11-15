import { Request, Response, NextFunction } from 'express';

// Wraps async route handlers to automatically forward uncaught rejections to express error handler
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};
