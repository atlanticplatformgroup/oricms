import type { Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { apiServices } from '../lib/api-services';
import { badRequest, created, internalError, notFound, ok } from '../lib/responses';
import { ensureResourceNotLocked } from '../locks/middleware';
import { ensureAdminAccess, serializeAgentToken } from './admin-route-common';

export async function listAgentTokens(req: Request, res: Response): Promise<void> {
  try {
    const projectId = req.query.projectId as string;
    if (!(await ensureAdminAccess(res, projectId, req.userId))) {
      return;
    }

    await Promise.all([
      query('page').optional().isInt({ min: 1 }).toInt().run(req),
      query('limit').optional().isInt({ min: 1, max: 100 }).toInt().run(req),
    ]);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      badRequest(res, 'Invalid pagination parameters', 'INVALID_PARAMS');
      return;
    }

    const page = typeof req.query.page === 'number' ? req.query.page : 1;
    const limit = Math.min(typeof req.query.limit === 'number' ? req.query.limit : 50, 100);
    const skip = (page - 1) * limit;

    const [tokens, total] = await Promise.all([
      apiServices.prisma.agentToken.findMany({
        where: { projectId },
        select: {
          id: true,
          userId: true,
          name: true,
          description: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
          sessionId: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      apiServices.prisma.agentToken.count({ where: { projectId } }),
    ]);
    ok(res, {
      tokens: tokens.map(serializeAgentToken),
      pagination: { page, limit, total, pageCount: Math.ceil(total / limit) },
    });
  } catch (error) {
    apiServices.logger.error({ msg: 'Agent tokens error', error });
    internalError(res, 'Failed to get tokens');
  }
}

export async function createAgentAdminToken(req: Request, res: Response): Promise<void> {
  try {
    const projectId = req.body.projectId;
    if (!(await ensureResourceNotLocked(req, res, {
      projectId,
      resourceType: 'agentConfig',
      resourceId: 'agent-tokens',
    }))) {
      return;
    }
    if (!(await ensureAdminAccess(res, projectId, req.userId))) {
      return;
    }

    const { userId, name, description, expiresInDays } = req.body;
    if (!userId || !name) {
      badRequest(res, 'userId and name are required');
      return;
    }

    const agentMember = await apiServices.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
      include: { user: { select: { id: true, type: true } } },
    });
    if (!agentMember || agentMember.userType !== 'AGENT' || agentMember.user.type !== 'AGENT') {
      badRequest(res, 'userId must belong to an AI agent member on this project', 'INVALID_AGENT_MEMBER');
      return;
    }

    const token = `agt_${Buffer.from(Math.random().toString()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`;
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;
    const agentToken = await apiServices.prisma.agentToken.create({
      data: { projectId, userId, token, name, description, expiresAt },
    });

    created(res, {
      id: agentToken.id,
      userId: agentToken.userId,
      token,
      name: agentToken.name,
      description: agentToken.description,
      expiresAt: agentToken.expiresAt,
    });
  } catch (error) {
    apiServices.logger.error({ msg: 'Agent token create error', error });
    internalError(res, 'Failed to create token');
  }
}

export async function revokeAgentAdminToken(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const projectId = req.body.projectId;
    if (!(await ensureResourceNotLocked(req, res, {
      projectId,
      resourceType: 'agentConfig',
      resourceId: `agent-token:${id}`,
    }))) {
      return;
    }
    if (!(await ensureAdminAccess(res, projectId, req.userId))) {
      return;
    }

    const token = await apiServices.prisma.agentToken.findFirst({ where: { id, projectId } });
    if (!token) {
      notFound(res, 'Token not found');
      return;
    }

    await apiServices.prisma.agentToken.update({ where: { id }, data: { revokedAt: new Date() } });
    ok(res, { message: 'Token revoked successfully' });
  } catch (error) {
    apiServices.logger.error({ msg: 'Agent token revoke error', error });
    internalError(res, 'Failed to revoke token');
  }
}
