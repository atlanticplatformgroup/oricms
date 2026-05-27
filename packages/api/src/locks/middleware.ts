import type { Request, Response } from 'express';
import type { LockResourceType } from '@ori/shared';
import { resourceLocked } from '../lib/responses';
import {
  getConflictingHardLock,
  ORI_SESSION_ID_HEADER,
  toLockConflictDetails,
} from './service';

function getSessionId(req: Request): string | undefined {
  const value = req.headers[ORI_SESSION_ID_HEADER];
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function ensureResourceNotLocked(
  req: Request,
  res: Response,
  params: {
    projectId: string;
    resourceType: LockResourceType;
    resourceId: string;
    branch?: string | null;
  },
): Promise<boolean> {
  if (!req.userId) {
    return true;
  }

  const conflict = await getConflictingHardLock({
    projectId: params.projectId,
    branch: params.branch,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    holderId: req.userId,
    sessionId: getSessionId(req),
  });

  if (!conflict) {
    return true;
  }

  resourceLocked(
    res,
    'This resource is currently locked for editing.',
    toLockConflictDetails(conflict, {
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      branch: params.branch,
    }),
  );
  return false;
}
