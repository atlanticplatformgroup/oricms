import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  projectFindUniqueMock,
  projectUpdateMock,
  auditLogCreateMock,
  cloneOrPullMock,
  getWorkspaceDirMock,
  findManyMock,
  findOneMock,
  listCollectionsMock,
  getContentTypeMock,
  checkPermissionMock,
  readdirMock,
  readFileMock,
  createEntryServiceMock,
  updateEntryServiceMock,
  deleteEntryServiceMock,
} = vi.hoisted(() => ({
  projectFindUniqueMock: vi.fn(),
  projectUpdateMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  cloneOrPullMock: vi.fn(),
  getWorkspaceDirMock: vi.fn(),
  findManyMock: vi.fn(),
  findOneMock: vi.fn(),
  listCollectionsMock: vi.fn(),
  getContentTypeMock: vi.fn(),
  checkPermissionMock: vi.fn(),
  readdirMock: vi.fn(),
  readFileMock: vi.fn(),
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
      update: projectUpdateMock,
    },
    auditLog: {
      create: auditLogCreateMock,
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
    findMany: findManyMock,
    findOne: findOneMock,
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

vi.mock('fs/promises', () => ({
  readdir: readdirMock,
  readFile: readFileMock,
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

describe('GraphQL routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectFindUniqueMock.mockResolvedValue({
      id: 'project-1',
      repoUrl: 'https://github.com/test/repo.git',
      defaultBranch: 'main',
      settings: {},
    });
    projectUpdateMock.mockResolvedValue({});
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
    readdirMock.mockResolvedValue(['post.yaml']);
    readFileMock.mockResolvedValue(`$schema: content-type-v1
$id: post
name: post
plural: posts
label: Post
labelPlural: Posts
fields:
  - key: title
    label: Title
    type: string
    required: true
`);
    findManyMock.mockResolvedValue({
      data: [
        {
          $id: 'hello-world',
          $type: 'post',
          $createdAt: '2026-03-01T00:00:00.000Z',
          $updatedAt: '2026-03-01T00:00:00.000Z',
          title: 'Hello',
        },
      ],
      meta: {
        pagination: {
          page: 1,
          pageSize: 20,
          pageCount: 1,
          total: 1,
        },
      },
    });
    findOneMock.mockResolvedValue({
      $id: 'hello-world',
      $type: 'post',
      $createdAt: '2026-03-01T00:00:00.000Z',
      $updatedAt: '2026-03-01T00:00:00.000Z',
      title: 'Hello',
    });
    checkPermissionMock.mockResolvedValue(true);
    auditLogCreateMock.mockResolvedValue({});
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

  it('returns content types from graphql query', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/graphql')
      .send({
        query: '{ contentTypes { id name fields { key type } } }',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.contentTypes).toHaveLength(1);
    expect(response.body.data.contentTypes[0].id).toBe('post');
    expect(response.body.meta.queryHash).toBeTypeOf('string');
    expect(response.body.meta.executionMs).toBeTypeOf('number');
  });

  it('returns generated graphql schema sdl', async () => {
    const response = await request(app)
      .get('/api/v1/projects/project-1/graphql/schema');

    expect(response.status).toBe(200);
    expect(response.text).toContain('type Query');
    expect(response.text).toContain('createPost');
    expect(response.text).toContain('type postRecord');
  });

  it('returns graphql introspection json', async () => {
    const response = await request(app)
      .get('/api/v1/projects/project-1/graphql/schema/introspection');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.__schema).toBeDefined();
    expect(response.body.data.__schema.queryType.name).toBe('Query');
  });

  it('returns persisted query allowlist settings', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      settings: {
        graphql: {
          deliveryPersistedQueries: {
            enabled: true,
            requirePersistedOnly: true,
            queries: [{
              id: 'pq-posts',
              query: '{ posts { id } }',
              sha256: 'abc123',
              createdAt: '2026-03-01T00:00:00.000Z',
            }],
          },
        },
      },
    });

    const response = await request(app)
      .get('/api/v1/projects/project-1/graphql/persisted-queries');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.enabled).toBe(true);
    expect(response.body.data.queries).toHaveLength(1);
    expect(response.body.data.queries[0].id).toBe('pq-posts');
    expect(response.body.data.queries[0].sha256).toBe('abc123');
  });

  it('updates persisted query allowlist settings', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      settings: {},
    });

    const response = await request(app)
      .put('/api/v1/projects/project-1/graphql/persisted-queries')
      .send({
        enabled: true,
        requirePersistedOnly: true,
        queries: [
          { id: 'pq-posts', query: '{ posts { id title } }', operationName: 'Posts' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.enabled).toBe(true);
    expect(response.body.data.requirePersistedOnly).toBe(true);
    expect(response.body.data.queries[0].id).toBe('pq-posts');
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('creates schema snapshot version entry', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      id: 'project-1',
      repoUrl: 'https://github.com/test/repo.git',
      defaultBranch: 'main',
      settings: {},
    });

    const response = await request(app)
      .post('/api/v1/projects/project-1/graphql/schema/snapshots');

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.created).toBe(true);
    expect(response.body.data.snapshot.version).toBe(1);
    expect(response.body.data.snapshot.hash).toBeTypeOf('string');
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('returns validation error when query exceeds cost limit', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/graphql')
      .send({
        query: 'query($limit: Int!) { records(type: "post", limit: $limit) { records { id type data } meta { pagination { total page pageSize pageCount } } } }',
        variables: { limit: 100 },
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(String(response.body.error.message)).toContain('maximum cost');
  });

  it('returns collection records from graphql query', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/graphql')
      .send({
        query: 'query($type: String!) { entries(type: $type) { entries { id type data } meta { pagination { total } } } }',
        variables: { type: 'post' },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.entries.meta.pagination.total).toBe(1);
    expect(response.body.data.entries.entries[0].id).toBe('hello-world');
  });

  it('returns typed dynamic fields for plural and singular queries', async () => {
    const listResponse = await request(app)
      .post('/api/v1/projects/project-1/graphql')
      .send({
        query: '{ posts { id title createdAt updatedAt } }',
      });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(listResponse.body.data.posts[0].id).toBe('hello-world');
    expect(listResponse.body.data.posts[0].title).toBe('Hello');

    const singleResponse = await request(app)
      .post('/api/v1/projects/project-1/graphql')
      .send({
        query: 'query($id: ID!) { post(id: $id) { id title } }',
        variables: { id: 'hello-world' },
      });

    expect(singleResponse.status).toBe(200);
    expect(singleResponse.body.success).toBe(true);
    expect(singleResponse.body.data.post.id).toBe('hello-world');
    expect(singleResponse.body.data.post.title).toBe('Hello');
  });

  it('validates query payload', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/graphql')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects overly long graphql query', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/graphql')
      .send({
        query: `query { contentTypes { id } }\n#${'x'.repeat(21000)}`,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates record via graphql mutation when permitted', async () => {
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
    expect(response.body.success).toBe(true);
    expect(response.body.data.createEntry.id).toBe('new-post');
    expect(createEntryServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        collectionId: 'post',
      }),
      { title: 'New Post' },
      expect.objectContaining({
        audit: { userId: 'user-1', action: 'collection.record.created' },
        plugin: { event: 'collection.record.created' },
      }),
    );
  });

  it('creates record via typed dynamic mutation', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/graphql')
      .send({
        query: 'mutation($data: JSON!) { createPost(data: $data) { id title type } }',
        variables: {
          data: { title: 'New Post' },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.createPost.id).toBe('new-post');
    expect(response.body.data.createPost.title).toBe('New Post');
    expect(createEntryServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        collectionId: 'post',
      }),
      { title: 'New Post' },
      expect.objectContaining({
        audit: { userId: 'user-1', action: 'collection.record.created' },
        plugin: { event: 'collection.record.created' },
      }),
    );
  });

  it('rejects record mutation when permission is missing', async () => {
    checkPermissionMock.mockResolvedValueOnce(false);
    const response = await request(app)
      .post('/api/v1/projects/project-1/graphql')
      .send({
        query: 'mutation { deleteEntry(type: "post", id: "hello-world") }',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('GRAPHQL_EXECUTION_ERROR');
    expect(String(response.body.error.details[0])).toContain('Forbidden');
    expect(deleteEntryServiceMock).not.toHaveBeenCalled();
  });
});
