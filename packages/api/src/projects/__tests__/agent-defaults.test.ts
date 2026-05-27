import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  initMock,
  listCollectionsMock,
} = vi.hoisted(() => ({
  initMock: vi.fn(),
  listCollectionsMock: vi.fn(),
}));

vi.mock('../../collections/service', () => ({
  CollectionService: vi.fn().mockImplementation(() => ({
    init: initMock,
    listCollections: listCollectionsMock,
  })),
}));

import { bootstrapAgentProjectDefaults } from '../agent-defaults';

describe('bootstrapAgentProjectDefaults', () => {
  const projectFindUniqueMock = vi.fn();
  const agentAccessFindUniqueMock = vi.fn();
  const agentAccessUpsertMock = vi.fn();
  const agentWriteConfigFindUniqueMock = vi.fn();
  const agentWriteConfigCreateMock = vi.fn();

  const prismaClient = {
    project: {
      findUnique: projectFindUniqueMock,
    },
    agentAccess: {
      findUnique: agentAccessFindUniqueMock,
      upsert: agentAccessUpsertMock,
    },
    agentWriteConfig: {
      findUnique: agentWriteConfigFindUniqueMock,
      create: agentWriteConfigCreateMock,
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    projectFindUniqueMock.mockResolvedValue({
      id: 'project-1',
      defaultBranch: 'main',
      repoUrl: null,
    });
    initMock.mockResolvedValue(undefined);
    listCollectionsMock.mockResolvedValue([
      { id: 'blog-posts' },
      { id: 'authors' },
    ]);
    agentAccessFindUniqueMock.mockResolvedValue(null);
    agentAccessUpsertMock.mockResolvedValue({});
    agentWriteConfigFindUniqueMock.mockResolvedValue(null);
    agentWriteConfigCreateMock.mockResolvedValue({});
  });

  it('enables agent access and seeds write configs for editable agent roles', async () => {
    const result = await bootstrapAgentProjectDefaults({
      projectId: 'project-1',
      role: 'editor',
      createdBy: 'user-1',
      prismaClient,
    });

    expect(agentAccessUpsertMock).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      create: expect.objectContaining({
        projectId: 'project-1',
        enabled: true,
        allowedBranches: ['main'],
        allowedCollections: ['blog-posts', 'authors'],
        createdBy: 'user-1',
      }),
      update: expect.objectContaining({
        enabled: true,
        allowedBranches: ['main'],
        allowedCollections: ['blog-posts', 'authors'],
      }),
    });
    expect(agentWriteConfigCreateMock).toHaveBeenCalledTimes(2);
    expect(agentWriteConfigCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        collectionName: 'blog-posts',
        mode: 'AUTO_PUBLISH',
        targetBranch: 'main',
        canCreate: true,
        canUpdate: true,
        canDelete: false,
      }),
    });
    expect(result).toEqual({
      defaultBranch: 'main',
      allowedCollections: ['blog-posts', 'authors'],
      writeConfigsCreated: 2,
    });
  });

  it('preserves existing non-empty agent access allowlists', async () => {
    agentAccessFindUniqueMock.mockResolvedValue({
      allowedBranches: ['release'],
      allowedCollections: ['authors'],
    });

    const result = await bootstrapAgentProjectDefaults({
      projectId: 'project-1',
      role: 'admin',
      prismaClient,
    });

    expect(agentAccessUpsertMock).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      create: expect.objectContaining({
        allowedBranches: ['release'],
        allowedCollections: ['authors'],
      }),
      update: expect.objectContaining({
        allowedBranches: ['release'],
        allowedCollections: ['authors'],
      }),
    });
    expect(result.allowedCollections).toEqual(['authors']);
  });

  it('does not create write configs for read-only agent roles', async () => {
    const result = await bootstrapAgentProjectDefaults({
      projectId: 'project-1',
      role: 'viewer',
      prismaClient,
    });

    expect(agentWriteConfigCreateMock).not.toHaveBeenCalled();
    expect(result.writeConfigsCreated).toBe(0);
  });
});
