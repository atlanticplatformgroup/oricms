import type { Response } from 'express';
import { created, forbidden, notFound, ok, staleRevision, validationError } from '../lib/responses';
import type {
  AgentMutationAction,
  AgentMutationPreflightRequest,
  AgentMutationResult,
} from '@ori/shared';

export function getPermissionAction(action: AgentMutationAction): 'create' | 'update' | 'delete' | 'publish' {
  switch (action) {
    case 'create':
      return 'create';
    case 'update':
      return 'update';
    case 'delete':
      return 'delete';
    case 'transition':
      return 'publish';
    case 'createSchema':
    case 'updateSchema':
      return 'update';
  }

  throw new Error(`Unsupported agent mutation action: ${String(action)}`);
}

export function getIdempotencyKey(headerValue: string | string[] | undefined): string | undefined {
  if (Array.isArray(headerValue)) {
    return headerValue[0];
  }
  return typeof headerValue === 'string' && headerValue.trim() ? headerValue.trim() : undefined;
}

export function sendMutationResponse(res: Response, result: AgentMutationResult): void {
  if (result.action === 'create' && result.persistence.persisted) {
    created(res, result);
    return;
  }
  ok(res, result);
}

export function respondMutationPreparationFailure(
  res: Response,
  preflight: { details?: Record<string, string[]>; entryId?: string; currentRevision?: string },
) {
  const details = preflight.details ?? {};
  if (details.entryId?.some((message) => message.includes('not found'))) {
    notFound(res, details.entryId[0], 'ENTRY_NOT_FOUND');
    return;
  }
  if (details.collectionName?.some((message) => message.includes('not found'))) {
    notFound(res, details.collectionName[0], 'COLLECTION_NOT_FOUND');
    return;
  }
  if (details.collectionName?.some((message) => message.includes('not allowed') || message.includes('not configured'))) {
    forbidden(res, details.collectionName[0], 'MUTATION_NOT_ALLOWED');
    return;
  }
  if (details.branch?.length) {
    forbidden(res, details.branch[0], 'BRANCH_NOT_ALLOWED');
    return;
  }
  if (details.baseRevision?.length) {
    staleRevision(res, details.baseRevision[0], {
      resourceType: ['entry'],
      ...(preflight.entryId ? { resourceId: [preflight.entryId] } : {}),
      ...(preflight.currentRevision ? { currentRevision: [preflight.currentRevision] } : {}),
    });
    return;
  }

  validationError(res, 'Mutation request is invalid', details);
}

export function buildDeniedPreflightResponse(body: AgentMutationPreflightRequest, message: string) {
  return {
    allowed: false,
    action: body.action,
    ...(body.collectionName ? { collectionName: body.collectionName } : {}),
    ...(body.schemaName ? { schemaName: body.schemaName } : {}),
    ...(body.entryId ? { entryId: body.entryId } : {}),
    autoPublish: false,
    requiresConfirmation: body.action === 'delete',
    details: { _errors: [message] },
  };
}
