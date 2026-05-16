import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mkdirMock,
  accessMock,
  writeFileMock,
  readFileMock,
  unlinkMock,
  commitAndPushMock,
  getCurrentCommitMock,
} = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  accessMock: vi.fn(),
  writeFileMock: vi.fn(),
  readFileMock: vi.fn(),
  unlinkMock: vi.fn(),
  commitAndPushMock: vi.fn(),
  getCurrentCommitMock: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mkdirMock,
    access: accessMock,
    writeFile: writeFileMock,
    readFile: readFileMock,
    unlink: unlinkMock,
  },
  mkdir: mkdirMock,
  access: accessMock,
  writeFile: writeFileMock,
  readFile: readFileMock,
  unlink: unlinkMock,
}));

import { StaleEntryRevisionError } from '../collection-errors';
import {
  createCollectionEntryMutation,
  deleteCollectionEntryMutation,
  updateCollectionEntryMutation,
} from '../collection-mutations';

const contentType = {
  $schema: 'content-type-v1' as const,
  $id: 'blog-post',
  name: 'blog-post',
  plural: 'blog-posts',
  label: 'Blog Post',
  labelPlural: 'Blog Posts',
  fields: [{ key: 'title', label: 'Title', type: 'string', required: true }],
};

const config = {
  id: 'blog-posts',
  label: 'Blog Posts',
  contentType: 'blog-post',
  path: 'content/blog-posts',
};

function createContext() {
  return {
    projectId: 'project-1',
    gitService: {
      commitAndPush: commitAndPushMock,
      getCurrentCommit: getCurrentCommitMock,
    },
    getResolvedPaths: vi.fn(async (relativePath: string) => ({
      absolute: `/tmp/project-1/repo/${relativePath}`,
      repoRelative: relativePath,
    })),
  };
}

describe('collection mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mkdirMock.mockResolvedValue(undefined);
    accessMock.mockRejectedValue(new Error('ENOENT'));
    writeFileMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(
      JSON.stringify({
        $id: 'hello-world',
        $type: 'blog-post',
        $status: 'draft',
        $createdAt: '2026-03-01T00:00:00.000Z',
        $updatedAt: '2026-03-01T00:00:00.000Z',
        title: 'Hello World',
      }),
    );
    unlinkMock.mockResolvedValue(undefined);
    commitAndPushMock.mockResolvedValue(undefined);
    getCurrentCommitMock.mockResolvedValue({
      hash: 'commit-123',
      shortHash: 'commit1',
      message: 'commit',
      author: 'Codex',
      email: 'agent@oricms.local',
      date: new Date().toISOString(),
      branch: 'main',
    });
  });

  it('defaults created entries to draft status', async () => {
    const result = await createCollectionEntryMutation({
      context: createContext(),
      collectionId: 'blog-posts',
      config,
      contentType,
      data: { title: 'Codex agent API test' },
      author: { name: 'Codex', email: 'agent@oricms.local' },
    });

    expect(result.entry.$status).toBe('draft');
    expect(writeFileMock).toHaveBeenCalledWith(
      '/tmp/project-1/repo/content/blog-posts/codex-agent-api-test.json',
      expect.stringContaining('"$status": "draft"'),
      'utf-8',
    );
  });

  it('rejects stale entry updates', async () => {
    await expect(
      updateCollectionEntryMutation({
        context: createContext(),
        config,
        contentType,
        id: 'hello-world',
        data: { title: 'Updated' },
        author: { name: 'Codex', email: 'agent@oricms.local' },
        baseRevision: 'stale-revision',
      }),
    ).rejects.toBeInstanceOf(StaleEntryRevisionError);
  });

  it('deletes an entry and commits the repo-relative path', async () => {
    const result = await deleteCollectionEntryMutation({
      context: createContext(),
      config,
      contentTypeLabel: contentType.label,
      id: 'hello-world',
      author: { name: 'Codex', email: 'agent@oricms.local' },
    });

    expect(unlinkMock).toHaveBeenCalledWith('/tmp/project-1/repo/content/blog-posts/hello-world.json');
    expect(commitAndPushMock).toHaveBeenCalledWith(
      'project-1',
      ['content/blog-posts/hello-world.json'],
      'Delete Blog Post entry from Blog Posts: hello-world',
      { name: 'Codex', email: 'agent@oricms.local' },
      true,
    );
    expect(result.previousEntry.$id).toBe('hello-world');
  });
});
