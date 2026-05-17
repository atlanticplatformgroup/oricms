import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  projectMemberFindUniqueMock: vi.fn(),
  projectMemberFindFirstMock: vi.fn(),
  agentAccessFindUniqueMock: vi.fn(),
  agentAccessUpsertMock: vi.fn(),
  ensureResourceNotLockedMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}));

vi.mock('../../auth/middleware', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.userId = 'user-1';
    next();
  },
}));

vi.mock('../../locks/middleware', () => ({
  ensureResourceNotLocked: (...args: unknown[]) => state.ensureResourceNotLockedMock(...args),
}));

vi.mock('../../lib/api-services', () => ({
  apiServices: {
    prisma: {
      projectMember: {
        findUnique: (...args: unknown[]) => state.projectMemberFindUniqueMock(...args),
        findFirst: (...args: unknown[]) => state.projectMemberFindFirstMock(...args),
      },
      agentAccess: {
        findUnique: (...args: unknown[]) => state.agentAccessFindUniqueMock(...args),
        upsert: (...args: unknown[]) => state.agentAccessUpsertMock(...args),
      },
    },
    logger: {
      error: (...args: unknown[]) => state.loggerErrorMock(...args),
      warn: (...args: unknown[]) => state.loggerWarnMock(...args),
    },
  },
}));

import router from '../admin-routes';

const app = express();
app.use(express.json());
app.use('/api/v1/agent', router);

describe('agent admin route permission project resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.projectMemberFindUniqueMock.mockResolvedValue({ role: 'owner' });
    state.projectMemberFindFirstMock.mockResolvedValue({ projectId: 'project-1', userId: 'user-1', role: 'owner' });
    state.agentAccessFindUniqueMock.mockResolvedValue(null);
    state.agentAccessUpsertMock.mockResolvedValue({
      enabled: true,
      allowedBranches: ['main'],
      allowedCollections: [],
      historyDepth: 30,
      historyDays: 14,
      deploymentMode: 'cloud',
    });
    state.ensureResourceNotLockedMock.mockResolvedValue(true);
  });

  it('uses query projectId for permission checks before reading agent config', async () => {
    const response = await request(app)
      .get('/api/v1/agent/v1/admin/config')
      .query({ projectId: 'project-1' });

    expect(response.status).toBe(200);
    expect(state.projectMemberFindUniqueMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_projectId: { userId: 'user-1', projectId: 'project-1' } },
    }));
    expect(response.body.data).toEqual({
      enabled: false,
      allowedBranches: ['main'],
      allowedCollections: [],
      historyDepth: 30,
      historyDays: 14,
      deploymentMode: 'cloud',
    });
  });

  it('uses body projectId for permission checks before updating agent config', async () => {
    const response = await request(app)
      .put('/api/v1/agent/v1/admin/config')
      .send({ projectId: 'project-1', enabled: true });

    expect(response.status).toBe(200);
    expect(state.projectMemberFindUniqueMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_projectId: { userId: 'user-1', projectId: 'project-1' } },
    }));
    expect(state.agentAccessUpsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: 'project-1' },
    }));
  });
});
