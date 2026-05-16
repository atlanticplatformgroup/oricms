import type { Request, Response } from 'express';
import type { EntryMutationContext } from '../application/entries/types';
import { badRequest, lifecycleBlocked, normalizeValidationDetails, notFound, staleRevision, validationError } from '../lib/responses';
import { LifecycleHookError } from '../plugins/dispatcher';
import { isValidEntryBranchTransferResolution } from './entry-branch-transfer';
import { StaleEntryRevisionError } from './service';

export type ProjectRecord = {
  id: string;
  repoUrl: string | null;
  defaultBranch: string;
};

export type EntryBranchTransferApplyPayload = {
  sourceBranch: string;
  targetBranch: string;
  mode: 'entire_entry' | 'selected_paths';
  selectedPointers?: string[];
  resolutions?: Array<{ pointer: string; strategy: 'source' | 'target' }>;
  message: string;
};

export function getRequestActor(req: Request): NonNullable<EntryMutationContext['actor']> {
  return {
    id: req.user?.id,
    name: req.user?.name,
    email: req.user?.email,
  };
}

export function respondCollectionValidationError(
  res: Response,
  details: unknown,
  message = 'Invalid input',
): void {
  validationError(res, message, normalizeValidationDetails(details));
}

export function respondProjectNotFound(res: Response): void {
  notFound(res, 'Project not found', 'PROJECT_NOT_FOUND');
}

export function parseEntryBranchTransferApplyPayloadOrRespond(
  payload: unknown,
  res: Response,
): EntryBranchTransferApplyPayload | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    respondCollectionValidationError(res, { body: ['Invalid branch transfer payload'] });
    return null;
  }

  const parsed = payload as EntryBranchTransferApplyPayload;
  const invalidResolution = (parsed.resolutions ?? []).find(
    (resolution) => !isValidEntryBranchTransferResolution(resolution),
  );
  if (invalidResolution) {
    respondCollectionValidationError(res, { resolutions: ['Invalid conflict resolutions'] });
    return null;
  }

  return parsed;
}

export function parseEntryUpdateBody(
  body: unknown,
): { data: Record<string, unknown>; baseRevision?: string } {
  const payload = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const { baseRevision, ...data } = payload;
  return {
    data,
    baseRevision: typeof baseRevision === 'string' ? baseRevision : undefined,
  };
}

export function parseEntryDeleteBody(body: unknown): { baseRevision?: string } {
  return {
    baseRevision: body && typeof body === 'object' && !Array.isArray(body) && typeof (body as { baseRevision?: unknown }).baseRevision === 'string'
      ? (body as { baseRevision: string }).baseRevision
      : undefined,
  };
}

export function parseEntryHistoryRequest(req: Request): { limit: number; branch?: string } {
  const limitParam = req.query.limit;
  return {
    limit: typeof limitParam === 'number'
      ? limitParam
      : typeof limitParam === 'string'
        ? parseInt(limitParam, 10) || 20
        : 20,
    branch: req.query.branch as string | undefined,
  };
}

export function respondEntryMutationError(
  res: Response,
  error: unknown,
  fallbackMessage: string,
  fallbackCode: string,
): void {
  if (error instanceof StaleEntryRevisionError) {
    staleRevision(res, 'This entry changed since you opened it.', {
      resourceType: ['entry'],
      resourceId: [error.entryId],
      currentRevision: [error.currentRevision],
    });
    return;
  }

  if (error instanceof LifecycleHookError) {
    lifecycleBlocked(res, error.message);
    return;
  }

  badRequest(res, error instanceof Error ? error.message : fallbackMessage, fallbackCode);
}
