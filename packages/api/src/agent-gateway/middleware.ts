import type { NextFunction, Request, Response } from 'express';
import { createAgentGateway, AgentAccessError } from './service';
import type { User } from '@ori/shared';
import { apiServices } from '../lib/api-services';
import { internalError, unauthorized } from '../lib/responses';

export async function authenticateAgentToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      unauthorized(res, 'Missing or invalid authorization header');
      return;
    }

    const token = authHeader.substring(7);
    const agentToken = await apiServices.prisma.agentToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            type: true,
            avatarUrl: true,
            githubId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!agentToken) {
      unauthorized(res, 'Invalid agent token', 'INVALID_AGENT_TOKEN');
      return;
    }
    if (agentToken.revokedAt) {
      unauthorized(res, 'Agent token has been revoked', 'REVOKED_AGENT_TOKEN');
      return;
    }
    if (agentToken.expiresAt && new Date() > agentToken.expiresAt) {
      unauthorized(res, 'Agent token has expired', 'EXPIRED_AGENT_TOKEN');
      return;
    }
    if (!agentToken.userId || !agentToken.user || agentToken.user.type !== 'AGENT') {
      unauthorized(res, 'Agent token is not linked to an active agent member', 'UNLINKED_AGENT_TOKEN');
      return;
    }

    const membership = await apiServices.prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: agentToken.userId,
          projectId: agentToken.projectId,
        },
      },
      select: { role: true, userType: true },
    });
    if (!membership || membership.userType !== 'AGENT') {
      unauthorized(res, 'Agent member is no longer part of this project', 'AGENT_MEMBER_NOT_FOUND');
      return;
    }

    await apiServices.prisma.agentToken.update({ where: { id: agentToken.id }, data: { lastUsedAt: new Date() } });

    req.projectId = agentToken.projectId;
    req.user = agentToken.user as unknown as User;
    req.userId = agentToken.userId;
    req.projectRole = membership.role;
    req.agentTokenId = agentToken.id;
    req.agentSessionId = agentToken.sessionId || `session-${Date.now()}`;

    const gateway = await createAgentGateway(agentToken.projectId, req.agentSessionId, membership.role);
    req.agentGateway = gateway;
    req.agentAccessConfig = gateway.config;

    next();
  } catch (error) {
    if (error instanceof AgentAccessError) {
      res.status(403).json({ success: false, error: { code: 'AGENT_ACCESS_DENIED', message: error.message } });
      return;
    }
    apiServices.logger.error({ msg: 'Agent authentication error', error });
    internalError(res, 'Authentication failed');
  }
}

export async function requireProjectMembership(projectId: string, userId?: string | null) {
  if (!projectId || !userId) return null;
  return apiServices.prisma.projectMember.findFirst({ where: { projectId, userId } });
}

export function handleAgentAccessError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof AgentAccessError) {
    res.status(403).json({ success: false, error: { code: 'AGENT_ACCESS_DENIED', message: error.message } });
    return;
  }
  apiServices.logger.error({ msg: fallbackMessage, error });
  internalError(res, fallbackMessage.replace(/^[^:]+: /, '') || 'Request failed');
}
