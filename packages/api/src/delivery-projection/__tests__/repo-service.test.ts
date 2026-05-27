import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionEntry } from '@ori/shared';

const {
  initMock,
  getCollectionConfigMock,
  getContentTypeMock,
  findManyMock,
  collectionServiceMock,
} = vi.hoisted(() => ({
  initMock: vi.fn(),
  getCollectionConfigMock: vi.fn(),
  getContentTypeMock: vi.fn(),
  findManyMock: vi.fn(),
  collectionServiceMock: vi.fn(),
}));

vi.mock('../../collections/service', () => ({
  CollectionService: collectionServiceMock.mockImplementation(() => ({
    init: initMock,
    getCollectionConfig: getCollectionConfigMock,
    getContentType: getContentTypeMock,
    findMany: findManyMock,
  })),
}));

import {
  createProjectionRepoService,
  getProjectionCollectionContentType,
  loadAllProjectionEntries,
} from '../repo-service';

describe('delivery projection repo-service helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and initializes a collection service for projection reads', async () => {
    await createProjectionRepoService({
      projectId: 'project-1',
      branch: 'preview',
      repoUrl: 'https://example.com/repo.git',
    });

    expect(collectionServiceMock).toHaveBeenCalledWith({
      projectId: 'project-1',
      branch: 'preview',
      repoUrl: 'https://example.com/repo.git',
    });
    expect(initMock).toHaveBeenCalledTimes(1);
  });

  it('returns the collection content type and preserves missing-config errors', async () => {
    const repoService = {
      getCollectionConfig: getCollectionConfigMock,
      getContentType: getContentTypeMock,
    } as never;

    getCollectionConfigMock.mockResolvedValueOnce(undefined);
    await expect(getProjectionCollectionContentType(repoService, 'posts')).rejects.toThrow(
      "Collection 'posts' not found",
    );

    getCollectionConfigMock.mockResolvedValueOnce({ contentType: 'article' });
    getContentTypeMock.mockResolvedValueOnce(undefined);
    await expect(getProjectionCollectionContentType(repoService, 'posts')).rejects.toThrow(
      "Content type 'article' for collection 'posts' not found",
    );

    getCollectionConfigMock.mockResolvedValueOnce({ contentType: 'article' });
    getContentTypeMock.mockResolvedValueOnce({ name: 'article', fields: [] });
    await expect(getProjectionCollectionContentType(repoService, 'posts')).resolves.toEqual({
      name: 'article',
      fields: [],
    });
  });

  it('loads all projected entries across paginated collection reads', async () => {
    const repoService = {
      findMany: findManyMock,
    } as never;
    const pageOne: CollectionEntry = { $id: '1', $type: 'article', title: 'One' };
    const pageTwo: CollectionEntry = { $id: '2', $type: 'article', title: 'Two' };

    findManyMock
      .mockResolvedValueOnce({
        data: [pageOne],
        meta: { pagination: { page: 1, pageCount: 2, pageSize: 100, total: 2 } },
      })
      .mockResolvedValueOnce({
        data: [pageTwo],
        meta: { pagination: { page: 2, pageCount: 2, pageSize: 100, total: 2 } },
      });

    await expect(loadAllProjectionEntries(repoService, 'posts')).resolves.toEqual([pageOne, pageTwo]);
    expect(findManyMock).toHaveBeenNthCalledWith(1, 'posts', { page: 1, limit: 100 });
    expect(findManyMock).toHaveBeenNthCalledWith(2, 'posts', { page: 2, limit: 100 });
  });
});
