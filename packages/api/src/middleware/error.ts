import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, string[]>;
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ msg: 'Unhandled API error', error: err, requestId: _req.requestId, path: _req.originalUrl, method: _req.method });

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(err.details && { details: err.details }),
    },
  });
}
