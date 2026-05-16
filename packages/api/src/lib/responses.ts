import type { Response } from 'express';

export type ValidationErrorDetails = Record<string, string[]>;

type ErrorPayload = {
  code: string;
  message: string;
  details?: ValidationErrorDetails;
};

function sendError(res: Response, statusCode: number, error: ErrorPayload): void {
  res.status(statusCode).json({ success: false, error });
}

export function ok<T>(res: Response, data: T): void {
  res.json({ success: true, data });
}

export function created<T>(res: Response, data: T): void {
  res.status(201).json({ success: true, data });
}

export function unauthorized(res: Response, message = 'Authentication required', code = 'UNAUTHORIZED'): void {
  sendError(res, 401, { code, message });
}

export function forbidden(res: Response, message = 'Forbidden', code = 'FORBIDDEN'): void {
  sendError(res, 403, { code, message });
}

export function badRequest(res: Response, message = 'Bad request', code = 'BAD_REQUEST'): void {
  sendError(res, 400, { code, message });
}

export function notFound(res: Response, message = 'Not found', code = 'NOT_FOUND'): void {
  sendError(res, 404, { code, message });
}

export function conflict(
  res: Response,
  message = 'Conflict',
  code = 'CONFLICT',
  details?: ValidationErrorDetails,
): void {
  sendError(res, 409, { code, message, ...(details ? { details } : {}) });
}

export function tooManyRequests(res: Response, message = 'Too many requests', code = 'RATE_LIMITED'): void {
  sendError(res, 429, { code, message });
}

export function serviceUnavailable(res: Response, message = 'Service unavailable', code = 'SERVICE_UNAVAILABLE'): void {
  sendError(res, 503, { code, message });
}

export function unprocessableEntity(res: Response, message = 'Request could not be processed', code = 'UNPROCESSABLE_ENTITY'): void {
  sendError(res, 422, { code, message });
}

export function internalError(res: Response, message = 'Request failed', code = 'INTERNAL_ERROR'): void {
  sendError(res, 500, { code, message });
}

export function lifecycleBlocked(res: Response, message: string): void {
  sendError(res, 400, { code: 'LIFECYCLE_BLOCKED', message });
}

export function resourceLocked(
  res: Response,
  message = 'Resource is locked',
  details?: ValidationErrorDetails,
): void {
  conflict(res, message, 'RESOURCE_LOCKED', details);
}

export function staleRevision(
  res: Response,
  message = 'This resource changed since it was opened',
  details?: ValidationErrorDetails,
): void {
  conflict(res, message, 'STALE_REVISION', details);
}

export function validationError(
  res: Response,
  message = 'Invalid input',
  details?: ValidationErrorDetails,
): void {
  sendError(res, 400, {
    code: 'VALIDATION_ERROR',
    message,
    ...(details ? { details } : {}),
  });
}

export function normalizeValidationDetails(details: unknown): ValidationErrorDetails | undefined {
  if (!details) return undefined;
  if (Array.isArray(details)) {
    return { _errors: details.map((value) => String(value)) };
  }
  if (typeof details !== 'object') {
    return { _errors: [String(details)] };
  }

  const next: ValidationErrorDetails = {};
  for (const [key, value] of Object.entries(details)) {
    if (Array.isArray(value)) {
      next[key] = value.map((item) => String(item));
      continue;
    }
    if (value && typeof value === 'object' && 'msg' in value) {
      next[key] = [String((value as { msg: unknown }).msg)];
      continue;
    }
    next[key] = [String(value)];
  }

  return Object.keys(next).length > 0 ? next : undefined;
}
