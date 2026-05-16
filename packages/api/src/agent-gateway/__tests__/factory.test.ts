import { beforeEach, describe, expect, it, vi } from 'vitest';

const { agentAccessFindUniqueMock } = vi.hoisted(() => ({
  agentAccessFindUniqueMock: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    agentAccess: {
      findUnique: (...args: unknown[]) => agentAccessFindUniqueMock(...args),
    },
  },
}));

import { AgentAccessError, createAgentGateway } from '../service';

describe('createAgentGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a gateway from persisted access config', async () => {
    const gitService = { marker: 'git-service' };
    agentAccessFindUniqueMock.mockResolvedValue({
      projectId: 'project-1',
      enabled: true,
      allowedBranches: ['main'],
      allowedCollections: ['posts'],
      historyDepth: 30,
      historyDays: 14,
      deploymentMode: 'cloud',
      createdAt: new Date('2026-03-13T09:00:00.000Z'),
      updatedAt: new Date('2026-03-13T10:00:00.000Z'),
      createdBy: 'user-1',
    });

    const gateway = await createAgentGateway('project-1', 'session-1', 'editor', gitService as any);

    expect(gateway.config).toEqual({
      projectId: 'project-1',
      enabled: true,
      allowedBranches: ['main'],
      allowedCollections: ['posts'],
      historyDepth: 30,
      historyDays: 14,
      deploymentMode: 'cloud',
      createdAt: '2026-03-13T09:00:00.000Z',
      updatedAt: '2026-03-13T10:00:00.000Z',
      createdBy: 'user-1',
    });
    expect(gateway.getGitService()).toBe(gitService);
  });

  it('throws when agent access is disabled or missing', async () => {
    agentAccessFindUniqueMock.mockResolvedValue(null);

    await expect(createAgentGateway('project-1', 'session-1', 'editor')).rejects.toThrow(AgentAccessError);
  });
});
