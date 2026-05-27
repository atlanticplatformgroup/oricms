import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findProject: vi.fn(),
  collectionServiceInit: vi.fn(),
  getCollectionConfig: vi.fn(),
  getContentType: vi.fn(),
  getFileAtBranch: vi.fn(),
  getMergeBase: vi.fn(),
  getFileAtRef: vi.fn(),
  applyFileChangesOnBranch: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: (...args: unknown[]) => mocks.findProject(...args),
    },
  },
}));

vi.mock('../service', () => ({
  CollectionService: vi.fn().mockImplementation(() => ({
    init: (...args: unknown[]) => mocks.collectionServiceInit(...args),
    getCollectionConfig: (...args: unknown[]) => mocks.getCollectionConfig(...args),
    getContentType: (...args: unknown[]) => mocks.getContentType(...args),
  })),
}));

vi.mock('../../git/service', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    getFileAtBranch: (...args: unknown[]) => mocks.getFileAtBranch(...args),
    getMergeBase: (...args: unknown[]) => mocks.getMergeBase(...args),
    getFileAtRef: (...args: unknown[]) => mocks.getFileAtRef(...args),
    applyFileChangesOnBranch: (...args: unknown[]) => mocks.applyFileChangesOnBranch(...args),
  })),
}));

import { EntryBranchTransferService } from '../entry-branch-transfer';

describe('EntryBranchTransferService', () => {
  const collectionConfig = {
    id: 'posts',
    label: 'Posts',
    contentType: 'post',
    path: 'content/posts',
  };
  const contentType = {
    $schema: 'content-type-v1',
    $id: 'post',
    name: 'post',
    plural: 'posts',
    label: 'Post',
    labelPlural: 'Posts',
    fields: [
      { key: 'title', label: 'Title', type: 'string' },
      { key: 'body', label: 'Body', type: 'text' },
    ],
    display: { primary: 'title' },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findProject.mockResolvedValue({
      id: 'project-1',
      defaultBranch: 'main',
      settings: { contentRoot: 'content' },
      repoUrl: null,
    });
    mocks.collectionServiceInit.mockResolvedValue(undefined);
    mocks.getCollectionConfig.mockResolvedValue(collectionConfig);
    mocks.getContentType.mockResolvedValue(contentType);
    mocks.getMergeBase.mockResolvedValue('base-sha');
    mocks.getFileAtRef.mockResolvedValue(JSON.stringify({
      $id: 'post-1',
      $type: 'post',
      $status: 'draft',
      $createdAt: '2026-01-01T00:00:00.000Z',
      $updatedAt: '2026-01-01T00:00:00.000Z',
      title: 'Base title',
      body: 'Base body',
    }));
    mocks.applyFileChangesOnBranch.mockResolvedValue({
      committed: true,
      hash: 'abc123',
      message: 'Apply selected changes',
    });
  });

  it('builds a field-aware preview with conflicts', async () => {
    mocks.getFileAtBranch.mockImplementation(async (_projectId: string, branch: string, filePath: string) => {
      if (filePath === 'oricms/collections.json') {
        return JSON.stringify([collectionConfig]);
      }
      if (filePath === 'schemas/types/post.json') {
        return JSON.stringify(contentType);
      }
      if (branch === 'main' && filePath === 'content/content/posts/post-1.json') {
        return JSON.stringify({
          $id: 'post-1',
          $type: 'post',
          $status: 'draft',
          $createdAt: '2026-01-01T00:00:00.000Z',
          $updatedAt: '2026-01-03T00:00:00.000Z',
          title: 'Source title',
          body: 'Base body',
        });
      }
      if (branch === 'staging' && filePath === 'content/content/posts/post-1.json') {
        return JSON.stringify({
          $id: 'post-1',
          $type: 'post',
          $status: 'draft',
          $createdAt: '2026-01-01T00:00:00.000Z',
          $updatedAt: '2026-01-02T00:00:00.000Z',
          title: 'Target title',
          body: 'Base body',
        });
      }
      return null;
    });

    const service = new EntryBranchTransferService('project-1');
    const preview = await service.preview('posts', 'post-1', 'main', 'staging');

    expect(preview.diffTree).toEqual([
      expect.objectContaining({
        pointer: '/title',
        label: 'Title',
        kind: 'changed',
        field: expect.objectContaining({ key: 'title', type: 'string' }),
      }),
    ]);
    expect(preview.conflicts).toEqual([{ pointer: '/title', label: 'Title' }]);
    expect(preview.modeAvailability.selected_paths).toBe(true);
    expect(preview.schemaCompatibility.matches).toBe(true);
  });

  it('rejects selected-path apply when the target entry does not exist', async () => {
    mocks.getFileAtBranch.mockImplementation(async (_projectId: string, branch: string, filePath: string) => {
      if (filePath === 'oricms/collections.json') {
        return JSON.stringify([collectionConfig]);
      }
      if (filePath === 'schemas/types/post.json') {
        return JSON.stringify(contentType);
      }
      if (branch === 'main' && filePath === 'content/content/posts/post-1.json') {
        return JSON.stringify({
          $id: 'post-1',
          $type: 'post',
          $status: 'draft',
          $createdAt: '2026-01-01T00:00:00.000Z',
          $updatedAt: '2026-01-03T00:00:00.000Z',
          title: 'Source title',
        });
      }
      return null;
    });

    const service = new EntryBranchTransferService('project-1');

    await expect(service.apply('posts', 'post-1', {
      sourceBranch: 'main',
      targetBranch: 'staging',
      mode: 'selected_paths',
      selectedPointers: ['/title'],
      message: 'Apply selected changes',
    }, {
      name: 'Owner',
      email: 'owner@example.com',
    })).rejects.toThrow('Selected changes require the entry to exist on the target branch');
  });

  it('requires explicit resolutions for selected conflicts', async () => {
    mocks.getFileAtBranch.mockImplementation(async (_projectId: string, branch: string, filePath: string) => {
      if (filePath === 'oricms/collections.json') {
        return JSON.stringify([collectionConfig]);
      }
      if (filePath === 'schemas/types/post.json') {
        return JSON.stringify(contentType);
      }
      if (branch === 'main' && filePath === 'content/content/posts/post-1.json') {
        return JSON.stringify({
          $id: 'post-1',
          $type: 'post',
          $status: 'draft',
          $createdAt: '2026-01-01T00:00:00.000Z',
          $updatedAt: '2026-01-03T00:00:00.000Z',
          title: 'Source title',
        });
      }
      if (branch === 'staging' && filePath === 'content/content/posts/post-1.json') {
        return JSON.stringify({
          $id: 'post-1',
          $type: 'post',
          $status: 'draft',
          $createdAt: '2026-01-01T00:00:00.000Z',
          $updatedAt: '2026-01-02T00:00:00.000Z',
          title: 'Target title',
        });
      }
      return null;
    });

    const service = new EntryBranchTransferService('project-1');

    await expect(service.apply('posts', 'post-1', {
      sourceBranch: 'main',
      targetBranch: 'staging',
      mode: 'selected_paths',
      selectedPointers: ['/title'],
      message: 'Apply selected changes',
    }, {
      name: 'Owner',
      email: 'owner@example.com',
    })).rejects.toThrow('Resolve all selected conflicts before applying changes');
  });

  it('writes selected source changes to the target branch only', async () => {
    mocks.getFileAtBranch.mockImplementation(async (_projectId: string, branch: string, filePath: string) => {
      if (filePath === 'oricms/collections.json') {
        return JSON.stringify([collectionConfig]);
      }
      if (filePath === 'schemas/types/post.json') {
        return JSON.stringify(contentType);
      }
      if (branch === 'main' && filePath === 'content/content/posts/post-1.json') {
        return JSON.stringify({
          $id: 'post-1',
          $type: 'post',
          $status: 'draft',
          $createdAt: '2026-01-01T00:00:00.000Z',
          $updatedAt: '2026-01-03T00:00:00.000Z',
          title: 'Source title',
          body: 'Source body',
        });
      }
      if (branch === 'staging' && filePath === 'content/content/posts/post-1.json') {
        return JSON.stringify({
          $id: 'post-1',
          $type: 'post',
          $status: 'draft',
          $createdAt: '2026-01-01T00:00:00.000Z',
          $updatedAt: '2026-01-02T00:00:00.000Z',
          title: 'Target title',
          body: 'Target body',
        });
      }
      return null;
    });

    const service = new EntryBranchTransferService('project-1');
    const result = await service.apply('posts', 'post-1', {
      sourceBranch: 'main',
      targetBranch: 'staging',
      mode: 'selected_paths',
      selectedPointers: ['/body'],
      resolutions: [{ pointer: '/body', strategy: 'source' }],
      message: 'Apply selected changes',
    }, {
      name: 'Owner',
      email: 'owner@example.com',
    });

    expect(mocks.applyFileChangesOnBranch).toHaveBeenCalledWith(
      'project-1',
      'staging',
      [
        expect.objectContaining({
          path: expect.stringContaining('posts/post-1.json'),
          content: expect.stringContaining('"body": "Source body"'),
        }),
      ],
      expect.objectContaining({
        message: 'Apply selected changes',
      }),
    );
    expect(result.appliedPointerCount).toBe(1);
  });

  it('blocks entry transfer when the branch schemas do not match', async () => {
    mocks.getFileAtBranch.mockImplementation(async (_projectId: string, branch: string, filePath: string) => {
      if (filePath === 'oricms/collections.json') {
        return JSON.stringify([collectionConfig]);
      }
      if (filePath === 'schemas/types/post.json') {
        if (branch === 'main') {
          return JSON.stringify(contentType);
        }
        return JSON.stringify({
          ...contentType,
          fields: [
            { key: 'title', label: 'Title', type: 'string' },
            { key: 'body', label: 'Body', type: 'json' },
          ],
        });
      }
      if (filePath === 'content/content/posts/post-1.json') {
        return JSON.stringify({
          $id: 'post-1',
          $type: 'post',
          $status: 'draft',
          $createdAt: '2026-01-01T00:00:00.000Z',
          $updatedAt: '2026-01-03T00:00:00.000Z',
          title: 'Source title',
        });
      }
      return null;
    });

    const service = new EntryBranchTransferService('project-1');
    const preview = await service.preview('posts', 'post-1', 'main', 'staging');

    expect(preview.schemaCompatibility).toEqual({
      matches: false,
      message: "This entry can't be copied because the schema differs between branches. Update the schema first, then try again.",
    });
    expect(preview.modeAvailability.entire_entry).toBe(false);

    await expect(service.apply('posts', 'post-1', {
      sourceBranch: 'main',
      targetBranch: 'staging',
      mode: 'entire_entry',
      message: 'Copy entry',
    }, {
      name: 'Owner',
      email: 'owner@example.com',
    })).rejects.toThrow('schema differs between branches');
  });
});
