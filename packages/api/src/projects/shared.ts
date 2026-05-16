import type { Response } from 'express';
import { internalError, normalizeValidationDetails, notFound, validationError } from '../lib/responses';

export function buildInviteLink(token: string): string {
  const base = process.env.APP_BASE_URL || process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5173';
  return `${base.replace(/\/$/, '')}/invite/${token}`;
}

export function sendValidationError(res: Response, details?: unknown, message = 'Invalid input') {
  validationError(res, message, normalizeValidationDetails(details));
}

export function sendNotFound(res: Response, message = 'Project not found') {
  notFound(res, message);
}

export function sendInternalError(res: Response, message: string) {
  internalError(res, message);
}
