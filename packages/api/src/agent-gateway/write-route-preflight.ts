import type { Request, Response } from 'express';
import { logger } from '../middleware/logger';
import { badRequest, internalError, ok } from '../lib/responses';
import { checkPermission } from '../permissions/middleware';
import { prepareAgentMutation } from './mutations';
import type { AgentMutationPreflightRequest } from '@ori/shared';
import { buildDeniedPreflightResponse, getPermissionAction } from './write-route-common';
import { runSchemaDefinitionPreflight } from './schema-definition-routes';

export async function runMutationPreflight(req: Request, res: Response): Promise<void> {
  try {
    if (await runSchemaDefinitionPreflight(req, res)) {
      return;
    }

    const body = req.body as AgentMutationPreflightRequest;
    if (!body?.action || !body.collectionName) {
      badRequest(res, 'action and collectionName are required', 'INVALID_PREFLIGHT_REQUEST');
      return;
    }

    const permissionAction = getPermissionAction(body.action);
    const permitted = await checkPermission(req.userId!, req.projectId!, 'collections', permissionAction, req.projectRole);
    if (!permitted) {
      ok(res, buildDeniedPreflightResponse(body, `You don't have permission to ${permissionAction} collections`));
      return;
    }

    const { preflight } = await prepareAgentMutation({
      gateway: req.agentGateway!,
      projectId: req.projectId!,
      principalId: req.userId!,
      collectionName: body.collectionName,
      action: body.action,
      entryId: body.entryId,
      inputData: body.data,
      targetStatus: body.targetStatus,
      requestedBranch: body.branch,
      baseRevision: body.baseRevision,
    });

    ok(res, preflight);
  } catch (error) {
    logger.error({ msg: 'Agent mutation preflight error', error });
    internalError(res, 'Failed to run mutation preflight');
  }
}
