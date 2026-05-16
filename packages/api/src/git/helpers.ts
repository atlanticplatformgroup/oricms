import type { Response } from 'express';
import { normalizeValidationDetails, validationError, lifecycleBlocked } from '../lib/responses';
import { LifecycleHookError } from '../plugins/dispatcher';

export function respondValidationError(res: Response, message: string, details?: unknown): void {
  validationError(res, message, normalizeValidationDetails(details));
}

export function respondLifecycleBlocked(res: Response, error: Error): void {
  lifecycleBlocked(res, error.message);
}

export function isLifecycleHookError(error: unknown): error is LifecycleHookError {
  return error instanceof LifecycleHookError;
}

export function formatGitError(error: unknown): { code: string; message: string } {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message;

  if (message.includes('Repository not found') || message.includes('does not exist')) {
    return { code: 'REPO_NOT_FOUND', message: 'Repository not found. Please check the repository URL.' };
  }

  if (message.includes('Authentication failed') || message.includes('could not read Username')) {
    return { code: 'AUTH_FAILED', message: 'Git authentication failed. Please check your repository credentials.' };
  }

  if (message.includes('Permission denied')) {
    return { code: 'PERMISSION_DENIED', message: 'Permission denied. You may not have access to this repository.' };
  }

  if (message.includes('Could not resolve host') || message.includes('Connection refused')) {
    return { code: 'NETWORK_ERROR', message: 'Could not connect to Git server. Please check your network connection.' };
  }

  if (message.includes('Merge conflict') || message.includes('CONFLICT')) {
    return { code: 'MERGE_CONFLICT', message: 'Merge conflict detected. Please resolve conflicts manually.' };
  }

  if (message.includes('pathspec') && message.includes('did not match')) {
    return { code: 'BRANCH_NOT_FOUND', message: 'Branch not found. Please check the branch name.' };
  }

  return { code: 'GIT_ERROR', message: 'Git operation failed. Please try again later.' };
}

export function normalizeSchemaPath(schemaPath: string, fallbackPrefix: 'components' | 'types'): string {
  if (schemaPath.startsWith('schemas/components/') || schemaPath.startsWith('schemas/types/')) {
    return schemaPath;
  }
  if (schemaPath.startsWith('components/') || schemaPath.startsWith('types/')) {
    return `schemas/${schemaPath}`;
  }
  return `schemas/${fallbackPrefix}/${schemaPath}`;
}
