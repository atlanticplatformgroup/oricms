import type { Response } from 'express';
import { requireProjectMembership } from './middleware';
import { badRequest, forbidden, unauthorized } from '../lib/responses';

export function serializeAgentConfig(config: {
  enabled: boolean;
  allowedBranches: string[];
  allowedCollections: string[];
  historyDepth: number;
  historyDays: number;
  deploymentMode: string;
}) {
  return {
    enabled: config.enabled,
    allowedBranches: config.allowedBranches,
    allowedCollections: config.allowedCollections,
    historyDepth: config.historyDepth,
    historyDays: config.historyDays,
    deploymentMode: config.deploymentMode,
  };
}

export function serializeAgentToken(token: {
  id: string;
  userId?: string | null;
  name: string;
  description: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  sessionId?: string | null;
}) {
  return {
    id: token.id,
    ...(token.userId !== undefined ? { userId: token.userId } : {}),
    name: token.name,
    description: token.description,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    ...(token.sessionId !== undefined ? { sessionId: token.sessionId } : {}),
  };
}

type ProjectAccessFailure = {
  ok: false;
  status: number;
  error: string;
  code: string;
};

async function ensureProjectAccess(projectId: string | undefined, userId?: string | null): Promise<{ ok: true } | ProjectAccessFailure> {
  if (!projectId) {
    return { ok: false, status: 400, error: 'projectId is required', code: 'BAD_REQUEST' };
  }
  const membership = await requireProjectMembership(projectId, userId);
  if (!membership) {
    return { ok: false, status: 403, error: 'Access denied to this project', code: 'FORBIDDEN' };
  }
  return { ok: true };
}

function sendAccessFailure(res: Response, access: ProjectAccessFailure) {
  if (access.status === 400) {
    badRequest(res, access.error, access.code);
    return;
  }
  if (access.status === 401) {
    unauthorized(res, access.error, access.code);
    return;
  }
  forbidden(res, access.error, access.code);
}

export async function ensureAdminAccess(res: Response, projectId: string | undefined, userId?: string | null): Promise<boolean> {
  const access = await ensureProjectAccess(projectId, userId);
  if (!access.ok) {
    sendAccessFailure(res, access);
    return false;
  }
  return true;
}
