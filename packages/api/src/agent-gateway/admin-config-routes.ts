import type { Request, Response } from 'express';
import { apiServices } from '../lib/api-services';
import { badRequest, internalError, ok } from '../lib/responses';
import { ensureResourceNotLocked } from '../locks/middleware';
import { ensureAdminAccess, serializeAgentConfig } from './admin-route-common';

export async function getAgentAdminConfig(req: Request, res: Response): Promise<void> {
  try {
    const projectId = (req.query.projectId as string) || req.body?.projectId;
    if (!(await ensureAdminAccess(res, projectId, req.userId))) {
      return;
    }

    const config = await apiServices.prisma.agentAccess.findUnique({ where: { projectId } });
    if (!config) {
      ok(res, serializeAgentConfig({
        enabled: false,
        allowedBranches: ['main'],
        allowedCollections: [],
        historyDepth: 30,
        historyDays: 14,
        deploymentMode: 'cloud',
      }));
      return;
    }

    ok(res, serializeAgentConfig(config));
  } catch (error) {
    apiServices.logger.error({ msg: 'Agent config error', error });
    internalError(res, 'Failed to get config');
  }
}

export async function updateAgentAdminConfig(req: Request, res: Response): Promise<void> {
  try {
    const projectId = req.body.projectId;
    if (!(await ensureResourceNotLocked(req, res, {
      projectId,
      resourceType: 'agentConfig',
      resourceId: 'agent-config',
    }))) {
      return;
    }
    if (!(await ensureAdminAccess(res, projectId, req.userId))) {
      return;
    }

    const { enabled, allowedBranches, allowedCollections, historyDepth, historyDays, deploymentMode } = req.body;
    if (deploymentMode && !['cloud', 'on-premise'].includes(deploymentMode)) {
      badRequest(res, 'Deployment mode must be cloud or on-premise');
      return;
    }

    const config = await apiServices.prisma.agentAccess.upsert({
      where: { projectId },
      create: {
        projectId,
        enabled: enabled ?? false,
        allowedBranches: allowedBranches ?? ['main'],
        allowedCollections: allowedCollections ?? [],
        historyDepth: historyDepth ?? 30,
        historyDays: historyDays ?? 14,
        deploymentMode: deploymentMode ?? 'cloud',
      },
      update: {
        ...(enabled !== undefined && { enabled }),
        ...(allowedBranches !== undefined && { allowedBranches }),
        ...(allowedCollections !== undefined && { allowedCollections }),
        ...(historyDepth !== undefined && { historyDepth }),
        ...(historyDays !== undefined && { historyDays }),
        ...(deploymentMode !== undefined && { deploymentMode }),
      },
    });

    ok(res, serializeAgentConfig(config));
  } catch (error) {
    apiServices.logger.error({ msg: 'Agent config update error', error });
    internalError(res, 'Failed to update config');
  }
}
