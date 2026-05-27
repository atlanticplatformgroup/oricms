import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { normalizeValidationDetails, validationError } from '../lib/responses';

export function sendAuthValidationError(res: Response, req: Request, message = 'Invalid input') {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return false;
  }

  validationError(res, message, normalizeValidationDetails(errors.mapped()));
  return true;
}
