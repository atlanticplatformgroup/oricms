import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  projectFindUniqueMock,
  cloneOrPullMock,
  getWorkspaceDirMock,
  createMock,
  updateMock,
  deleteMock,
  listCollectionsMock,
  getContentTypeMock,
  checkPermissionMock,
  createEntryServiceMock,
  updateEntryServiceMock,
  deleteEntryServiceMock,
} = vi.hoisted(() => ({
  projectFindUniqueMock: vi.fn(),
  cloneOrPullMock: vi.fn(),
  getWorkspaceDirMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  listCollectionsMock: vi.fn(),
  getContentTypeMock: vi.fn(),
  checkPermissionMock: vi.fn(),
  createEntryServiceMock: vi.fn(),
  updateEntryServiceMock: vi.fn(),
  deleteEntryServiceMock: vi.fn(),
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  checkPermission: checkPermissionMock,
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: projectFindUniqueMock,
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../../git/service', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    cloneOrPull: cloneOrPullMock,
    getWorkspaceDir: getWorkspaceDirMock,
  })),
}));

vi.mock('../../collections/service', () => ({
  CollectionService: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    listCollections: listCollectionsMock,
    getContentType: getContentTypeMock,
    create: createMock,
    update: updateMock,
    delete: deleteMock,
    findMany: vi.fn().mockResolvedValue({
      data: [],
      meta: { pagination: { page: 1, pageSize: 20, pageCount: 0, total: 0 } },
    }),
    findOne: vi.fn().mockResolvedValue(null),
  })),
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

import router from '../routes';

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as express.Request & { user?: unknown }).user = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
  };
  next();
});
app.use('/api/v1/projects/:projectId/graphql', router);

describe('GraphQL lifecycle dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectFindUniqueMock.mockResolvedValue({
      id: 'project-1',
      repoUrl: 'https://github.com/test/repo.git',
      defaultBranch: 'main',
      settings: {},
    });
    getWorkspaceDirMock.mockReturnValue('/tmp/workspace/project-1');
    listCollectionsMock.mockResolvedValue([
      {
        id: 'post',
        label: 'Posts',
        description: 'Post collection',
        contentType: 'post',
      },
    ]);
    getContentTypeMock.mockResolvedValue({
      plural: 'posts',
      labelPlural: 'Posts',
      description: 'Post collection',
      fields: [
        { key: 'title', label: 'Title', type: 'string', required: true },
      ],
    });
    createMock.mockResolvedValue({
      $id: 'new-post',
      $type: 'post',
      $createdAt: '2026-03-01T01:00:00.000Z',
      $updatedAt: '2026-03-01T01:00:00.000Z',
      title: 'New Post',
    });
    updateMock.mockResolvedValue({
      $id: 'hello-world',
      $type: 'post',
      $createdAt: '2026-03-01T00:00:00.000Z',
      $updatedAt: '2026-03-01T02:00:00.000Z',
      title: 'Updated',
    });
    deleteMock.mockResolvedValue(undefined);
    checkPermissionMock.mockResolvedValue(true);
    createEntryServiceMock.mockResolvedValue({ entry: {
      $id: 'new-post',
      $type: 'post',
      $createdAt: '2026-03-01T01:00:00.000Z',
      $updatedAt: '2026-03-01T01:00:00.000Z',
      title: 'New Post',
    }, entryId: 'new-post' });
    updateEntryServiceMock.mockResolvedValue({ entry: {
      $id: 'hello-world',
      $type: 'post',
      $createdAt: '2026-03-01T00:00:00.000Z',
      $updatedAt: '2026-03-01T02:00:00.000Z',
      title: 'Updated',
    }, entryId: 'hello-world' });
    deleteEntryServiceMock.mockResolvedValue({ entryId: 'hello-world' });
  });

  it('routes createEntry through the entry application service', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/graphql')
      .send({
        query: 'mutation($type: String!, $data: JSON!) { createEntry(type: $type, data: $data) { id type data } }',
        variables: {
          type: 'post',
          data: { title: 'New Post' },
        },
      });

    expect(response.status).toBe(200);
    expect(createEntryServiceMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      collectionId: 'post',
    }), { title: 'New Post' }, expect.objectContaining({
      plugin: { event: 'collection.record.created' },
    }));
  });

  it('routes updateEntry and deleteEntry through the entry application services', async () => {
    const updateResponse = await request(app)
      .post('/api/v1/projects/project-1/graphql')
      .send({
        query: 'mutation($type: String!, $id: ID!, $data: JSON!) { updateEntry(type: $type, id: $id, data: $data) { id type data } }',
        variables: {
          type: 'post',
          id: 'hello-world',
          data: { title: 'Updated' },
        },
      });

    expect(updateResponse.status).toBe(200);
    expect(updateEntryServiceMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      collectionId: 'post',
    }), 'hello-world', { title: 'Updated' }, expect.objectContaining({
      plugin: { event: 'collection.record.updated' },
    }));

    const deleteResponse = await request(app)
      .post('/api/v1/projects/project-1/graphql')
      .send({
        query: 'mutation($type: String!, $id: ID!) { deleteEntry(type: $type, id: $id) }',
        variables: {
          type: 'post',
          id: 'hello-world',
        },
      });

    expect(deleteResponse.status).toBe(200);
    expect(deleteEntryServiceMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      collectionId: 'post',
    }), 'hello-world', expect.objectContaining({
      plugin: { event: 'collection.record.deleted' },
    }));
  });
});
