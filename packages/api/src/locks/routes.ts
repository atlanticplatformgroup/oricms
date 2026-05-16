import { Router, type Request, type Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import type { Action, LockAcquireRequest, LockResourceType, Resource } from '@ori/shared';
import { badRequest, internalError, normalizeValidationDetails, ok, resourceLocked, unauthorized, validationError } from '../lib/responses';
import { checkPermission } from '../permissions/middleware';
import {
  acquireResourceLock,
  getResourceLocks,
  LockConflictError,
  LockTokenError,
  ORI_LOCK_TOKEN_HEADER,
  ORI_SESSION_ID_HEADER,
  releaseResourceLock,
  renewResourceLock,
  toLockConflictDetails,
  type LockHolder,
} from './service';
import { apiServices } from '../lib/api-services';

const router = Router({ mergeParams: true });

function getSessionId(req: Request): string | null {
  const headerValue = req.headers[ORI_SESSION_ID_HEADER];
  if (Array.isArray(headerValue)) {
    return typeof headerValue[0] === 'string' && headerValue[0].trim() ? headerValue[0].trim() : null;
  }
  return typeof headerValue === 'string' && headerValue.trim() ? headerValue.trim() : null;
}

function getLockToken(req: Request): string | undefined {
  const headerValue = req.headers[ORI_LOCK_TOKEN_HEADER];
  if (Array.isArray(headerValue)) {
    return headerValue[0];
  }
  return typeof headerValue === 'string' && headerValue.trim() ? headerValue.trim() : undefined;
}

function getPermissionForResource(resourceType: LockResourceType, reason: LockAcquireRequest['reason']): { resource: Resource; action: Action } {
  switch (resourceType) {
    case 'schema':
    case 'contentType':
    case 'collectionConfig':
    case 'branchPromotion':
    case 'entry':
    case 'bulkMutation':
      return { resource: 'collections', action: reason === 'deleting' ? 'delete' : 'update' };
    case 'assetMetadata':
      return { resource: 'assets', action: 'update' };
    case 'projectSettings':
      return { resource: 'settings', action: 'update' };
    case 'members':
      return { resource: 'members', action: reason === 'deleting' ? 'delete' : 'update' };
    case 'agentConfig':
      return { resource: 'agents', action: 'update' };
  }
  throw new Error(`Unsupported lock resource type: ${String(resourceType)}`);
}

function buildHolder(req: Request): LockHolder | null {
  const sessionId = getSessionId(req);
  if (!req.userId || !req.user || !sessionId) {
    return null;
  }
  return {
    holderType: req.user.type === 'AGENT' ? 'agent' : 'human',
    holderId: req.userId,
    holderName: req.user.name,
    sessionId,
  };
}

router.get(
  '/status',
  [
    query('resourceType').isString().trim().notEmpty(),
    query('resourceId').isString().trim().notEmpty(),
    query('branch').optional().isString().trim(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      validationError(res, 'Invalid lock query', normalizeValidationDetails(errors.mapped()));
      return;
    }

    const holder = buildHolder(req);
    if (!holder) {
      unauthorized(res, 'Authentication and session id are required');
      return;
    }

    try {
      const { projectId } = req.params as { projectId: string };
      const resourceType = req.query.resourceType as LockResourceType;
      const resourceId = req.query.resourceId as string;
      const branch = (req.query.branch as string | undefined) ?? null;
      const { resource, action } = getPermissionForResource(resourceType, 'editing');
      const permitted = await checkPermission(holder.holderId, projectId, resource, action, req.projectRole);
      if (!permitted) {
        unauthorized(res, 'You do not have permission to inspect this lock');
        return;
      }
      const locks = await getResourceLocks({ projectId, branch, resourceType, resourceId });
      ok(res, { locks });
    } catch (error) {
      apiServices.logger.error({ msg: 'Lock status error', error });
      internalError(res, 'Failed to load lock status');
    }
  },
);

router.post(
  '/acquire',
  [
    body('resourceType').isString().trim().notEmpty(),
    body('resourceId').isString().trim().notEmpty(),
    body('branch').optional().isString().trim(),
    body('mode').isIn(['hard', 'soft']),
    body('reason').isIn(['editing', 'deleting', 'promoting', 'configuring', 'bulk-mutation']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      validationError(res, 'Invalid lock request', normalizeValidationDetails(errors.mapped()));
      return;
    }

    const holder = buildHolder(req);
    if (!holder) {
      unauthorized(res, 'Authentication and session id are required');
      return;
    }

    try {
      const { projectId } = req.params as { projectId: string };
      const request = req.body as LockAcquireRequest;
      const { resource, action } = getPermissionForResource(request.resourceType, request.reason);
      const permitted = await checkPermission(holder.holderId, projectId, resource, action, req.projectRole);
      if (!permitted) {
        unauthorized(res, 'You do not have permission to lock this resource');
        return;
      }
      const response = await acquireResourceLock(projectId, request, holder);
      ok(res, response);
    } catch (error) {
      if (error instanceof LockConflictError) {
        resourceLocked(
          res,
          'This resource is currently locked for editing.',
          toLockConflictDetails(error.lock, {
            resourceType: error.resourceType,
            resourceId: error.resourceId,
            branch: error.branch,
          }),
        );
        return;
      }
      apiServices.logger.error({ msg: 'Lock acquire error', error });
      internalError(res, 'Failed to acquire lock');
    }
  },
);

router.post(
  '/renew',
  [body('lockId').isString().trim().notEmpty()],
  async (req: Request, res: Response) => {
    const holder = buildHolder(req);
    if (!holder) {
      unauthorized(res, 'Authentication and session id are required');
      return;
    }
    try {
      const response = await renewResourceLock({
        lockId: req.body.lockId as string,
        holderId: holder.holderId,
        sessionId: holder.sessionId,
        lockToken: getLockToken(req),
      });
      ok(res, response);
    } catch (error) {
      if (error instanceof LockTokenError) {
        badRequest(res, error.message, 'INVALID_LOCK_TOKEN');
        return;
      }
      apiServices.logger.error({ msg: 'Lock renew error', error });
      internalError(res, 'Failed to renew lock');
    }
  },
);

router.post(
  '/release',
  [body('lockId').isString().trim().notEmpty()],
  async (req: Request, res: Response) => {
    const holder = buildHolder(req);
    if (!holder) {
      unauthorized(res, 'Authentication and session id are required');
      return;
    }
    try {
      await releaseResourceLock({
        lockId: req.body.lockId as string,
        holderId: holder.holderId,
        sessionId: holder.sessionId,
        lockToken: getLockToken(req),
      });
      ok(res, { released: true });
    } catch (error) {
      if (error instanceof LockTokenError) {
        badRequest(res, error.message, 'INVALID_LOCK_TOKEN');
        return;
      }
      apiServices.logger.error({ msg: 'Lock release error', error });
      internalError(res, 'Failed to release lock');
    }
  },
);

export default router;
