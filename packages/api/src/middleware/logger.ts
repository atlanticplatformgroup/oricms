import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import winston from 'winston';

// Configure Winston logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ori-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
    }),
  ],
});

// HTTP request logger middleware
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  req.requestId = req.requestId || crypto.randomUUID();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      msg: 'HTTP request complete',
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.userId,
      projectId: req.params?.projectId || req.projectId,
      agentTokenId: req.agentTokenId,
      ip: req.ip,
    });
  });

  next();
}

// Audit logger for important actions
export async function auditLog(
  action: string,
  req: Request,
  metadata: {
    projectId?: string;
    resourceType: string;
    resourceId?: string;
    oldValue?: unknown;
    newValue?: unknown;
  }
): Promise<void> {
  logger.info({
    type: 'audit',
    action,
    requestId: req.requestId,
    userId: req.userId,
    ...metadata,
  });

  // In production, also save to database
  // await prisma.auditLog.create({...})
}
