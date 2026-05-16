import type { Request, Response } from 'express';
import { logger } from '../middleware/logger';
import {
  badRequest,
  conflict,
  forbidden,
  internalError,
  tooManyRequests,
} from '../lib/responses';
import { checkPermission } from '../permissions/middleware';
import { prepareAgentMutation } from './mutations';
import type { AgentEntryStatus, AgentMutationAction } from '@ori/shared';
import {
  getIdempotencyKey,
  getPermissionAction,
  respondMutationPreparationFailure,
  sendMutationResponse,
} from './write-route-common';
import { executePreparedMutation } from './write-route-execution';

export interface AgentMutationRouteParams {
  action: AgentMutationAction;
  collectionName: string;
  entryId?: string;
  inputData?: Record<string, unknown>;
  targetStatus?: AgentEntryStatus;
}

export async function handleAgentMutation(req: Request, res: Response, params: AgentMutationRouteParams): Promise<void> {
  const projectId = req.projectId!;
  const userId = req.userId!;
  const permissionAction = getPermissionAction(params.action);
  const permitted = await checkPermission(userId, projectId, 'collections', permissionAction, req.projectRole);
  if (!permitted) {
    forbidden(res, `You don't have permission to ${permissionAction} collections`);
    return;
  }

  const { prepared, preflight } = await prepareAgentMutation({
    gateway: req.agentGateway!,
    projectId,
    principalId: userId,
    collectionName: params.collectionName,
    action: params.action,
    entryId: params.entryId,
    inputData: params.inputData,
    targetStatus: params.targetStatus,
    requestedBranch: typeof req.body?.branch === 'string' ? req.body.branch : undefined,
    baseRevision: typeof req.body?.baseRevision === 'string' ? req.body.baseRevision : undefined,
  });

  if (!prepared) {
    respondMutationPreparationFailure(res, preflight);
    return;
  }

  try {
    const result = await executePreparedMutation(req, prepared, getIdempotencyKey(req.headers['idempotency-key']));
    sendMutationResponse(res, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'RATE_LIMIT_EXCEEDED') {
      tooManyRequests(res, 'Rate limit exceeded');
      return;
    }
    if (message.startsWith('IDEMPOTENCY_CONFLICT:')) {
      conflict(res, message.replace('IDEMPOTENCY_CONFLICT:', ''), 'IDEMPOTENCY_CONFLICT');
      return;
    }
    if (message.startsWith('CONFIRMATION_REQUIRED:')) {
      badRequest(res, message.replace('CONFIRMATION_REQUIRED:', ''), 'CONFIRMATION_REQUIRED');
      return;
    }
    logger.error({
      msg: 'Agent mutation error',
      action: params.action,
      collectionName: params.collectionName,
      entryId: params.entryId,
      error,
    });
    internalError(res, 'Failed to process mutation');
  }
}
