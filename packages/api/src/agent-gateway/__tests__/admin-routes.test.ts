import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  requireProjectMembershipMock: vi.fn(),
  ensureResourceNotLockedMock: vi.fn(),
  agentAccessFindUniqueMock: vi.fn(),
  agentAccessUpsertMock: vi.fn(),
  agentTokenFindManyMock: vi.fn(),
  agentTokenCreateMock: vi.fn(),
  agentTokenFindFirstMock: vi.fn(),
  agentTokenUpdateMock: vi.fn(),
  projectMemberFindUniqueMock: vi.fn(),
  agentConsentCreateMock: vi.fn(),
  agentConsentFindManyMock: vi.fn(),
  agentConsentFindFirstMock: vi.fn(),
  agentConsentUpdateMock: vi.fn(),
  getAuditLogsMock: vi.fn(),
  getAuditSummaryMock: vi.fn(),
  exportAuditLogsMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('../../auth/middleware', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.userId = 'user-1';
    next();
  },
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../middleware', async () => {
  const actual = await vi.importActual<typeof import('../middleware')>('../middleware');
  return {
    ...actual,
    requireProjectMembership: (...args: unknown[]) => state.requireProjectMembershipMock(...args),
  };
});

vi.mock('../../locks/middleware', () => ({
  ensureResourceNotLocked: (...args: unknown[]) => state.ensureResourceNotLockedMock(...args),
}));

vi.mock('../audit', () => ({
  getAuditLogs: (...args: unknown[]) => state.getAuditLogsMock(...args),
  getAuditSummary: (...args: unknown[]) => state.getAuditSummaryMock(...args),
  exportAuditLogs: (...args: unknown[]) => state.exportAuditLogsMock(...args),
}));

vi.mock('../../lib/api-services', () => ({
  apiServices: {
    prisma: {
      agentAccess: {
        findUnique: (...args: unknown[]) => state.agentAccessFindUniqueMock(...args),
        upsert: (...args: unknown[]) => state.agentAccessUpsertMock(...args),
      },
      agentToken: {
        findMany: (...args: unknown[]) => state.agentTokenFindManyMock(...args),
        create: (...args: unknown[]) => state.agentTokenCreateMock(...args),
        findFirst: (...args: unknown[]) => state.agentTokenFindFirstMock(...args),
        update: (...args: unknown[]) => state.agentTokenUpdateMock(...args),
      },
      projectMember: {
        findUnique: (...args: unknown[]) => state.projectMemberFindUniqueMock(...args),
      },
      agentConsent: {
        create: (...args: unknown[]) => state.agentConsentCreateMock(...args),
        findMany: (...args: unknown[]) => state.agentConsentFindManyMock(...args),
        findFirst: (...args: unknown[]) => state.agentConsentFindFirstMock(...args),
        update: (...args: unknown[]) => state.agentConsentUpdateMock(...args),
      },
    },
    logger: {
      error: (...args: unknown[]) => state.loggerErrorMock(...args),
    },
  },
}));

import router from '../admin-routes';

const app = express();
app.use(express.json());
app.use(router);

describe('agent admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireProjectMembershipMock.mockResolvedValue({ projectId: 'project-1', userId: 'user-1', role: 'owner' });
    state.ensureResourceNotLockedMock.mockResolvedValue(true);
    state.agentAccessFindUniqueMock.mockResolvedValue(null);
    state.agentAccessUpsertMock.mockResolvedValue({
      enabled: true,
      allowedBranches: ['main'],
      allowedCollections: ['blog-posts'],
      historyDepth: 30,
      historyDays: 14,
      deploymentMode: 'cloud',
    });
    state.agentTokenFindManyMock.mockResolvedValue([]);
    state.agentTokenCreateMock.mockResolvedValue({
      id: 'token-1',
      userId: 'agent-user-1',
      name: 'Codex',
      description: 'Test token',
      expiresAt: null,
    });
    state.agentTokenFindFirstMock.mockResolvedValue(null);
    state.projectMemberFindUniqueMock.mockResolvedValue(null);
    state.agentConsentCreateMock.mockResolvedValue({
      id: 'consent-1',
      projectId: 'project-1',
      userId: 'user-1',
      termsVersion: '1.0.0',
      termsAcceptedAt: new Date('2026-03-13T12:00:00.000Z'),
    });
    state.agentConsentFindManyMock.mockResolvedValue([]);
    state.agentConsentFindFirstMock.mockResolvedValue(null);
    state.agentConsentUpdateMock.mockResolvedValue(null);
  });

  it('returns the default agent config when none is stored', async () => {
    const response = await request(app).get('/v1/admin/config').query({ projectId: 'project-1' });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      enabled: false,
      allowedBranches: ['main'],
      allowedCollections: [],
      historyDepth: 30,
      historyDays: 14,
      deploymentMode: 'cloud',
    });
  });

  it('rejects token creation when the project member is not an agent', async () => {
    const response = await request(app)
      .post('/v1/admin/tokens')
      .send({ projectId: 'project-1', userId: 'user-2', name: 'Codex' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_AGENT_MEMBER');
  });

  it('returns not found when revoking a missing consent record', async () => {
    const response = await request(app)
      .post('/v1/admin/consent/consent-404/revoke')
      .send({ projectId: 'project-1' });

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe('Consent record not found');
  });
});
