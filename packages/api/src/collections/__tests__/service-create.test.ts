import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mkdirMock,
  accessMock,
  writeFileMock,
  commitAndPushMock,
  getCurrentCommitMock,
} = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  accessMock: vi.fn(),
  writeFileMock: vi.fn(),
  commitAndPushMock: vi.fn(),
  getCurrentCommitMock: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mkdirMock,
    access: accessMock,
    writeFile: writeFileMock,
  },
  mkdir: mkdirMock,
  access: accessMock,
  writeFile: writeFileMock,
}));

import { CollectionService } from '../service';

describe('CollectionService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mkdirMock.mockResolvedValue(undefined);
    accessMock.mockRejectedValue(new Error('ENOENT'));
    writeFileMock.mockResolvedValue(undefined);
    commitAndPushMock.mockResolvedValue(undefined);
    getCurrentCommitMock.mockResolvedValue({
      hash: 'commit-123',
      shortHash: 'commit1',
      message: 'Create Blog Post entry in Blog Posts: codex-agent-api-test',
      author: 'Codex',
      email: 'agent@oricms.local',
      date: new Date().toISOString(),
      branch: 'main',
    });
  });

  it('defaults new entries to draft status when none is provided', async () => {
    const service = new CollectionService({
      projectId: 'project-1',
      repoUrl: '',
      branch: 'main',
    });

    vi.spyOn(service, 'getCollectionConfig').mockResolvedValue({
      id: 'blog-posts',
      label: 'Blog Posts',
      contentType: 'blog-post',
      path: 'content/blog-posts',
    });
    vi.spyOn(service, 'getContentType').mockResolvedValue({
      $schema: 'content-type-v1',
      $id: 'blog-post',
      name: 'blog-post',
      plural: 'blog-posts',
      label: 'Blog Post',
      labelPlural: 'Blog Posts',
      fields: [
        { key: 'title', label: 'Title', type: 'string', required: true },
      ],
    });
    vi.spyOn(service as any, 'getResolvedPaths').mockResolvedValue({
      absolute: '/tmp/project-1/repo/content/blog-posts/codex-agent-api-test.json',
      repoRelative: 'content/blog-posts/codex-agent-api-test.json',
    });
    (service as any).gitService = {
      commitAndPush: commitAndPushMock,
      getCurrentCommit: getCurrentCommitMock,
    };

    const { entry } = await service.create(
      'blog-posts',
      { title: 'Codex agent API test' },
      { name: 'Codex', email: 'agent@oricms.local' },
    );

    expect(entry.$status).toBe('draft');
    expect(writeFileMock).toHaveBeenCalledWith(
      '/tmp/project-1/repo/content/blog-posts/codex-agent-api-test.json',
      expect.stringContaining('"$status": "draft"'),
      'utf-8',
    );
  });
});
