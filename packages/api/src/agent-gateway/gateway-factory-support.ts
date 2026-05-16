import type { AgentAccessConfig } from '@ori/shared';
import { prisma } from '../lib/prisma';
import { AgentAccessError } from './errors';

export async function loadAgentGatewayConfig(projectId: string): Promise<AgentAccessConfig> {
  const agentAccess = await prisma.agentAccess.findUnique({
    where: { projectId },
  });

  if (!agentAccess || !agentAccess.enabled) {
    throw new AgentAccessError('Agent access is not enabled for this project');
  }

  return {
    projectId: agentAccess.projectId,
    enabled: agentAccess.enabled,
    allowedBranches: agentAccess.allowedBranches,
    allowedCollections: agentAccess.allowedCollections,
    historyDepth: agentAccess.historyDepth,
    historyDays: agentAccess.historyDays,
    deploymentMode: agentAccess.deploymentMode as 'cloud' | 'on-premise',
    createdAt: agentAccess.createdAt.toISOString(),
    updatedAt: agentAccess.updatedAt.toISOString(),
    createdBy: agentAccess.createdBy ?? '',
  };
}
