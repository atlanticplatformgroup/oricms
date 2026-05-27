import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  projectFindUniqueMock,
  initMock,
  listCollectionsMock,
  findManyMock,
  findOneWithRevisionMock,
  getHistoryMock,
  getFileAtCommitMock,
  saveCollectionsConfigMock,
  deleteCollectionMutationMock,
  createEntryServiceMock,
  updateEntryServiceMock,
  deleteEntryServiceMock,
  collectionValidationErrorClass,
  lifecycleHookErrorClass,
} = vi.hoisted(() => ({
  projectFindUniqueMock: vi.fn(),
  initMock: vi.fn(),
  listCollectionsMock: vi.fn(),
  findManyMock: vi.fn(),
  findOneWithRevisionMock: vi.fn(),
  getHistoryMock: vi.fn(),
  getFileAtCommitMock: vi.fn(),
  saveCollectionsConfigMock: vi.fn(),
  deleteCollectionMutationMock: vi.fn(),
  createEntryServiceMock: vi.fn(),
  updateEntryServiceMock: vi.fn(),
  deleteEntryServiceMock: vi.fn(),
  collectionValidationErrorClass: class CollectionValidationError extends Error {},
  lifecycleHookErrorClass: class LifecycleHookError extends Error {},
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: projectFindUniqueMock,
    },
  },
}));

vi.mock('../service', () => ({
  CollectionValidationError: collectionValidationErrorClass,
  CollectionService: vi.fn().mockImplementation(() => ({
    init: initMock,
    listCollections: listCollectionsMock,
    findMany: findManyMock,
    findOneWithRevision: findOneWithRevisionMock,
    getHistory: getHistoryMock,
    getFileAtCommit: getFileAtCommitMock,
  })),
}));

vi.mock('../../plugins/dispatcher', () => ({
  LifecycleHookError: lifecycleHookErrorClass,
}));

vi.mock('../../application/collections/save-collections-config', () => ({
  saveCollectionsConfig: (...args: unknown[]) => saveCollectionsConfigMock(...args),
}));

vi.mock('../../application/collections/delete-collection', () => ({
  deleteCollection: (...args: unknown[]) => deleteCollectionMutationMock(...args),
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

vi.mock('../../resources/service', () => ({
  createResourceCollectionLink: vi.fn((id: string, domain: string, collectionType: string) => ({
    id,
    domain,
    collectionType,
    isSystem: collectionType !== 'user',
  })),
  getContentResourceCollectionId: vi.fn((collectionId: string) => `content.${collectionId}`),
}));

import router from '../routes';
import schemaAliasRouter from '../schema-alias-routes';

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as express.Request & { user?: unknown }).user = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
  };
  next();
});
app.use('/api/v1/projects/:projectId/collections', router);
app.use('/api/v1/projects/:projectId/schemas', schemaAliasRouter);

describe('Collections routes', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    projectFindUniqueMock.mockResolvedValue({
      id: projectId,
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
    });
    initMock.mockResolvedValue(undefined);
    listCollectionsMock.mockResolvedValue([]);
    findManyMock.mockResolvedValue({ entries: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
    findOneWithRevisionMock.mockResolvedValue({ entry: { $id: 'hello-world', title: 'Hello World' }, revision: 'rev-1' });
    getHistoryMock.mockResolvedValue([{ hash: 'abc123', message: 'Created entry' }]);
    getFileAtCommitMock.mockResolvedValue({ $id: 'hello-world', title: 'Historical World' });
    createEntryServiceMock.mockResolvedValue({ entry: { $id: 'hello-world', title: 'Hello World' }, entryId: 'hello-world' });
    updateEntryServiceMock.mockResolvedValue({ entry: { $id: 'hello-world', title: 'Changed' }, entryId: 'hello-world' });
    deleteEntryServiceMock.mockResolvedValue({ entryId: 'hello-world' });
    saveCollectionsConfigMock.mockResolvedValue({ createdCollections: [] });
    deleteCollectionMutationMock.mockResolvedValue(undefined);
  });

  it('returns validation error when collection paths are duplicated', async () => {
    saveCollectionsConfigMock.mockRejectedValueOnce(
      new collectionValidationErrorClass("Collection path 'content/shared' is already in use"),
    );

    const response = await request(app)
      .put(`/api/v1/projects/${projectId}/collections`)
      .send({
        collections: [
          { id: 'posts', label: 'Posts', contentType: 'post', path: 'content/shared' },
          { id: 'pages', label: 'Pages', contentType: 'page', path: 'content/shared' },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('deletes a collection and preserves the content type', async () => {
    const response = await request(app).delete(`/api/v1/projects/${projectId}/collections/posts`);

    expect(response.status).toBe(200);
    expect(deleteCollectionMutationMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId,
      actor: expect.objectContaining({ email: 'test@example.com' }),
    }), 'posts');
  });

  it('routes collection config updates through the collection application service', async () => {
    const response = await request(app)
      .put(`/api/v1/projects/${projectId}/collections`)
      .send({
        collections: [
          { id: 'posts', label: 'Posts', contentType: 'post', path: 'content/posts' },
          { id: 'pages', label: 'Pages', contentType: 'page', path: 'content/pages' },
        ],
      });

    expect(response.status).toBe(200);
    expect(saveCollectionsConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId,
      actor: expect.objectContaining({ email: 'test@example.com' }),
    }), expect.arrayContaining([
      expect.objectContaining({ id: 'posts' }),
      expect.objectContaining({ id: 'pages' }),
    ]));
  });

  it('includes resource metadata when listing collections', async () => {
    listCollectionsMock.mockResolvedValueOnce([
      { id: 'posts', label: 'Posts', contentType: 'post', path: 'content/posts' },
    ]);

    const response = await request(app).get(`/api/v1/projects/${projectId}/collections`);

    expect(response.status).toBe(200);
    expect(response.body.data.collections[0].resource).toEqual({
      id: 'content.posts',
      domain: 'content',
      collectionType: 'user',
      isSystem: false,
    });
  });

  it('exposes schema-first aliases for schema config and entries', async () => {
    listCollectionsMock.mockResolvedValueOnce([
      { id: 'posts', label: 'Posts', contentType: 'post', path: 'content/posts' },
    ]);

    const configResponse = await request(app).get(`/api/v1/projects/${projectId}/schemas`);

    expect(configResponse.status).toBe(200);
    expect(configResponse.body.data.collections[0]).toMatchObject({ id: 'posts' });

    const entryResponse = await request(app)
      .post(`/api/v1/projects/${projectId}/schemas/posts/entries`)
      .send({ title: 'Schema Entry' });

    expect(entryResponse.status).toBe(201);
    expect(createEntryServiceMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId,
      collectionId: 'posts',
    }), { title: 'Schema Entry' }, expect.any(Object));
  });

  it('lists collection entries with parsed query params', async () => {
    findManyMock.mockResolvedValueOnce({
      entries: [{ $id: 'hello-world', title: 'Hello World' }],
      pagination: { page: 2, limit: 10, total: 1, pages: 1 },
    });

    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/collections/posts`)
      .query({
        filter: JSON.stringify({ status: 'published' }),
        sort: JSON.stringify([{ field: 'title', order: 'asc' }]),
        page: '2',
        limit: '10',
        search: 'hello',
        populate: 'author',
      });

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith('posts', {
      filter: { status: 'published' },
      sort: [{ field: 'title', order: 'asc' }],
      page: 2,
      limit: 10,
      search: 'hello',
      populate: 'author',
    });
    expect(response.body.data.entries[0]).toMatchObject({ $id: 'hello-world' });
  });

  it('returns a single entry with revision metadata', async () => {
    findOneWithRevisionMock.mockResolvedValueOnce({
      entry: { $id: 'hello-world', title: 'Hello World' },
      revision: 'rev-42',
    });

    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/collections/posts/hello-world`)
      .query({ populate: 'author' });

    expect(response.status).toBe(200);
    expect(findOneWithRevisionMock).toHaveBeenCalledWith('posts', 'hello-world', 'author');
    expect(response.body.data.meta.revision).toBe('rev-42');
  });

  it('creates an entry and dispatches lifecycle events', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/collections/posts`)
      .send({ title: 'Hello World' });

    expect(response.status).toBe(201);
    expect(createEntryServiceMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId,
      collectionId: 'posts',
      repoUrl: 'https://example.com/repo.git',
      branch: 'main',
      actor: expect.objectContaining({ email: 'test@example.com' }),
    }), { title: 'Hello World' }, expect.objectContaining({
      plugin: { event: 'collection.record.created' },
    }));
  });

  it('updates an entry and forwards base revision with lifecycle event metadata', async () => {
    const response = await request(app)
      .put(`/api/v1/projects/${projectId}/collections/posts/hello-world`)
      .send({ title: 'Changed', baseRevision: 'rev-2' });

    expect(response.status).toBe(200);
    expect(updateEntryServiceMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId,
      collectionId: 'posts',
      repoUrl: 'https://example.com/repo.git',
      branch: 'main',
      actor: expect.objectContaining({ email: 'test@example.com' }),
    }), 'hello-world', { title: 'Changed' }, expect.objectContaining({
      plugin: { event: 'collection.record.updated' },
    }), undefined, 'rev-2');
  });

  it('deletes an entry and forwards base revision with lifecycle event metadata', async () => {
    const response = await request(app)
      .delete(`/api/v1/projects/${projectId}/collections/posts/hello-world`)
      .send({ baseRevision: 'rev-3' });

    expect(response.status).toBe(200);
    expect(deleteEntryServiceMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId,
      collectionId: 'posts',
      repoUrl: 'https://example.com/repo.git',
      branch: 'main',
      actor: expect.objectContaining({ email: 'test@example.com' }),
    }), 'hello-world', expect.objectContaining({
      plugin: { event: 'collection.record.deleted' },
    }), undefined, 'rev-3');
  });

  it('loads entry history with parsed limit and branch params', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/collections/posts/hello-world/history`)
      .query({ limit: '15', branch: 'feature-x' });

    expect(response.status).toBe(200);
    expect(getHistoryMock).toHaveBeenCalledWith('posts', 'hello-world', 15);
    expect(response.body.data.history[0]).toMatchObject({ hash: 'abc123' });
  });

  it('loads entry version content for a commit hash', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${projectId}/collections/posts/hello-world/history/deadbeef`)
      .query({ branch: 'feature-x' });

    expect(response.status).toBe(200);
    expect(getFileAtCommitMock).toHaveBeenCalledWith('posts', 'hello-world', 'deadbeef');
    expect(response.body.data.entry).toMatchObject({ $id: 'hello-world' });
  });

  it('returns lifecycle blocked when a before hook rejects collection deletion', async () => {
    deleteCollectionMutationMock.mockRejectedValueOnce(new lifecycleHookErrorClass('blocked'));

    const response = await request(app).delete(`/api/v1/projects/${projectId}/collections/posts`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('LIFECYCLE_BLOCKED');
    expect(deleteCollectionMutationMock).toHaveBeenCalled();
  });

  it('returns 404 when the project does not exist', async () => {
    projectFindUniqueMock.mockResolvedValueOnce(null);

    const response = await request(app).delete(`/api/v1/projects/${projectId}/collections/posts`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PROJECT_NOT_FOUND');
    expect(deleteCollectionMutationMock).not.toHaveBeenCalled();
  });
});
