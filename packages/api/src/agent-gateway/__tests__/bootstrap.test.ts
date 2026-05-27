import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentAccessConfig, ProjectRole } from '@ori/shared';

const {
  projectFindUniqueMock,
  agentWriteConfigFindManyMock,
} = vi.hoisted(() => ({
  projectFindUniqueMock: vi.fn(),
  agentWriteConfigFindManyMock: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: projectFindUniqueMock,
    },
    agentWriteConfig: {
      findMany: agentWriteConfigFindManyMock,
    },
  },
}));

vi.mock('../../collections/service', () => {
  class MockCollectionService {
    async init() {}

    async listCollections() {
      return [
        { id: 'blog-posts', label: 'Blog Posts', contentType: 'blog-post', path: 'content/blog-posts' },
        { id: 'authors', label: 'Authors', contentType: 'author', path: 'content/authors' },
      ];
    }
  }

  return { CollectionService: MockCollectionService };
});

import { AgentGatewayService } from '../service';

describe('AgentGatewayService bootstrap', () => {
  const projectId = 'project-bootstrap';
  let config: AgentAccessConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    projectFindUniqueMock.mockResolvedValue({
      id: projectId,
      name: 'Bootstrap Project',
    });
    agentWriteConfigFindManyMock.mockResolvedValue([
      {
        collectionName: 'blog-posts',
        mode: 'AUTO_PUBLISH',
        targetBranch: 'main',
        canCreate: true,
        canUpdate: true,
        canDelete: false,
        updatedAt: new Date('2026-03-13T12:00:00.000Z'),
      },
      {
        collectionName: 'authors',
        mode: 'HUMAN_REVIEW',
        targetBranch: 'main',
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        updatedAt: new Date('2026-03-13T11:00:00.000Z'),
      },
    ]);
    config = {
      projectId,
      enabled: true,
      allowedBranches: ['main'],
      allowedCollections: ['blog-posts', 'authors'],
      historyDepth: 30,
      historyDays: 14,
      deploymentMode: 'cloud',
      createdAt: '2026-03-13T09:00:00.000Z',
      updatedAt: '2026-03-13T10:00:00.000Z',
      createdBy: 'user-1',
    };
  });

  function createService(projectRole: ProjectRole = 'admin') {
    return new AgentGatewayService({
      projectId,
      agentSessionId: 'session-1',
      projectRole,
      config,
      gitService: {} as any,
    });
  }

  it('returns a compact project-specific bootstrap payload', async () => {
    const service = createService('admin');
    const result = await service.getSessionBootstrap();

    expect(result.project).toEqual({
      id: projectId,
      name: 'Bootstrap Project',
      branch: 'main',
      role: 'admin',
    });
    expect(result.capabilities).toEqual({
      allowedBranches: ['main'],
      readableCollections: ['blog-posts', 'authors'],
      writableCollections: ['blog-posts'],
      publishableCollections: ['blog-posts', 'authors'],
    });
    expect(result.contentModel.collections).toEqual([
      { id: 'blog-posts', label: 'Blog Posts', contentType: 'blog-post' },
      { id: 'authors', label: 'Authors', contentType: 'author' },
    ]);
    expect(result.entryIdentity).toEqual({
      canonicalField: '$id',
      slugIsCanonicalId: false,
      useReturnedEntryIdAfterCreate: true,
    });
    expect(result.workflow).toEqual({
      defaultEntryStatus: 'draft',
      readyStatusValue: 'published',
      readyStatusLabel: 'Ready',
      publishRequiresExplicitIntent: true,
      destructiveChangesRequireConfirmation: true,
    });
    expect(result.writePolicies).toEqual([
      {
        collectionName: 'blog-posts',
        mode: 'AUTO_PUBLISH',
        targetBranch: 'main',
        canCreate: true,
        canUpdate: true,
        canDelete: false,
      },
    ]);
    expect(result.generatedAt).toBeTruthy();
    expect(result.configVersion).toMatch(/^[a-f0-9]{64}$/);
    expect(result.configUpdatedAt).toBe('2026-03-13T12:00:00.000Z');
    expect(result.summaryMarkdown).toContain('Project: Bootstrap Project');
    expect(result.summaryMarkdown).toContain('- blog-posts -> blog-post');
    expect(result.summaryMarkdown).toContain('Use returned `entryId` / `$id` as the canonical entry identifier.');
    expect(result.summaryMarkdown).toContain('New entries default to `draft`.');
  });
});
