import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  readdirMock,
  getCurrentRevisionMock,
} = vi.hoisted(() => ({
  readdirMock: vi.fn(),
  getCurrentRevisionMock: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    readdir: readdirMock,
  },
  readdir: readdirMock,
}));

vi.mock('../git/service', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    getCurrentRevision: getCurrentRevisionMock,
    getWorkspaceDir: vi.fn().mockReturnValue('/tmp/workspace'),
  })),
}));

vi.mock('../git/runtime', () => ({
  getProjectGit: vi.fn().mockResolvedValue({}),
  ensureProjectCloned: vi.fn().mockResolvedValue(undefined),
  withPreparedGit: vi.fn().mockImplementation(async (_projectId, _branch, fn) => fn()),
}));

import { CollectionService } from '../service';

describe('CollectionService CRUD unit tests', () => {
  let service: CollectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CollectionService({ projectId: 'test-project', branch: 'main' });
    (service as any).workspacePath = '/tmp/workspace';
    (service as any).gitService = {
      getCurrentRevision: getCurrentRevisionMock,
      getWorkspaceDir: vi.fn().mockReturnValue('/tmp/workspace'),
    };
  });

  it('listCollections returns empty array when no collections exist', async () => {
    readdirMock.mockRejectedValue(new Error('ENOENT'));
    const result = await service.listCollections();
    expect(result).toEqual([]);
  });

  it('getCollectionConfig returns null for non-existent collection', async () => {
    readdirMock.mockRejectedValue(new Error('ENOENT'));
    const result = await service.getCollectionConfig('nonexistent');
    expect(result).toBeNull();
  });

  it('findOne returns null when collection does not exist', async () => {
    readdirMock.mockRejectedValue(new Error('ENOENT'));
    const result = await service.findOne('nonexistent', 'entry-1');
    expect(result).toBeNull();
  });

  it('findMany throws when collection does not exist', async () => {
    readdirMock.mockRejectedValue(new Error('ENOENT'));
    await expect(service.findMany('nonexistent')).rejects.toThrow("Collection 'nonexistent' not found");
  });

  it('getCurrentRevision returns current git revision', async () => {
    getCurrentRevisionMock.mockResolvedValue('rev123');
    const result = await service.getCurrentRevision();
    expect(result).toBe('rev123');
  });
});
