import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  updateChangeRequestMock,
  getCurrentCommitMock,
  createEntryServiceMock,
  updateEntryServiceMock,
  deleteEntryServiceMock,
} = vi.hoisted(() => ({
  updateChangeRequestMock: vi.fn(),
  getCurrentCommitMock: vi.fn(),
  createEntryServiceMock: vi.fn(),
  updateEntryServiceMock: vi.fn(),
  deleteEntryServiceMock: vi.fn(),
}));

vi.mock('../../application/entries/create-entry', () => ({
  createEntry: (...args: unknown[]) => createEntryServiceMock(...args),
}));

vi.mock('../../application/entries/update-entry', () => ({
  updateEntry: (...args: unknown[]) => updateEntryServiceMock(...args),
}));

vi.mock('../../application/entries/delete-entry', () => ({
  deleteEntry: (...args: unknown[]) => deleteEntryServiceMock(...args),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    agentChangeRequest: {
      update: updateChangeRequestMock,
    },
  },
}));

import { tryAutoPublishChange } from '../../application/agent-publish/auto-publish-change';

describe('agent auto-publish lifecycle dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createEntryServiceMock.mockResolvedValue({ entry: { $id: 'new-post', title: 'New Post' }, entryId: 'new-post' });
    updateEntryServiceMock.mockResolvedValue({ entry: { $id: 'entry-1', title: 'Updated' }, entryId: 'entry-1' });
    deleteEntryServiceMock.mockResolvedValue({ entryId: 'entry-1' });
    updateChangeRequestMock.mockResolvedValue({});
    getCurrentCommitMock.mockResolvedValue({ hash: 'abc123' });
  });

  const gateway = {
    gitService: {
      getCurrentCommit: getCurrentCommitMock,
    },
  } as any;

  it('dispatches lifecycle events for CREATE and marks change request auto-published', async () => {
    const result = await tryAutoPublishChange({
      projectId: 'project-1',
      targetBranch: 'main',
      collectionName: 'post',
      action: 'CREATE',
      changeRequestId: 'cr-1',
      after: { title: 'New Post' },
      agentTokenId: 'agt_12345678',
      gateway,
    });

    expect(result.status).toBe('AUTO_PUBLISHED');
    expect(createEntryServiceMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      collectionId: 'post',
    }), { title: 'New Post' });
    expect(updateChangeRequestMock).toHaveBeenCalledWith({
      where: { id: 'cr-1' },
      data: expect.objectContaining({
        status: 'AUTO_PUBLISHED',
        commitSha: 'abc123',
        entryId: 'new-post',
      }),
    });
  });

  it('dispatches lifecycle events for UPDATE', async () => {
    const result = await tryAutoPublishChange({
      projectId: 'project-1',
      targetBranch: 'main',
      collectionName: 'post',
      action: 'UPDATE',
      changeRequestId: 'cr-2',
      entryId: 'entry-1',
      after: { title: 'Updated' },
      agentTokenId: 'agt_12345678',
      gateway,
    });

    expect(result.status).toBe('AUTO_PUBLISHED');
    expect(updateEntryServiceMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      collectionId: 'post',
    }), 'entry-1', { title: 'Updated' });
  });

  it('dispatches lifecycle events for TRANSITION through update semantics', async () => {
    const result = await tryAutoPublishChange({
      projectId: 'project-1',
      targetBranch: 'main',
      collectionName: 'post',
      action: 'TRANSITION',
      changeRequestId: 'cr-transition',
      entryId: 'entry-1',
      after: { $status: 'published', $publishedAt: '2026-03-13T12:00:00.000Z' },
      agentTokenId: 'agt_12345678',
      gateway,
    });

    expect(result.status).toBe('AUTO_PUBLISHED');
    expect(updateEntryServiceMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      collectionId: 'post',
    }), 'entry-1', { $status: 'published', $publishedAt: '2026-03-13T12:00:00.000Z' });
  });

  it('dispatches lifecycle events for DELETE', async () => {
    const result = await tryAutoPublishChange({
      projectId: 'project-1',
      targetBranch: 'main',
      collectionName: 'post',
      action: 'DELETE',
      changeRequestId: 'cr-3',
      entryId: 'entry-1',
      after: {},
      agentTokenId: 'agt_12345678',
      gateway,
    });

    expect(result.status).toBe('AUTO_PUBLISHED');
    expect(deleteEntryServiceMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      collectionId: 'post',
    }), 'entry-1');
  });

  it('returns pending when lifecycle blocks auto-publish', async () => {
    createEntryServiceMock.mockRejectedValueOnce(new Error('blocked'));

    const result = await tryAutoPublishChange({
      projectId: 'project-1',
      targetBranch: 'main',
      collectionName: 'post',
      action: 'CREATE',
      changeRequestId: 'cr-4',
      after: { title: 'New Post' },
      agentTokenId: 'agt_12345678',
      gateway,
    });

    expect(result.status).toBe('PENDING');
    expect(updateChangeRequestMock).toHaveBeenCalledWith({
      where: { id: 'cr-4' },
      data: { reviewComment: 'Auto-publish failed: blocked' },
    });
  });
});
