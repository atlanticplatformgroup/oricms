import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import router from '../delivery-routes';

const {
  findUniqueMock,
  ensureCurrentMock,
  listRecordsMock,
  getRecordMock,
  initMock,
  listCollectionsMock,
  getContentTypeMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  ensureCurrentMock: vi.fn(),
  listRecordsMock: vi.fn(),
  getRecordMock: vi.fn(),
  initMock: vi.fn(),
  listCollectionsMock: vi.fn(),
  getContentTypeMock: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock('../../collections/service', () => ({
  CollectionService: vi.fn().mockImplementation(() => ({
    init: initMock,
    listCollections: listCollectionsMock,
    getContentType: getContentTypeMock,
  })),
}));

vi.mock('../../delivery-projection/service', () => ({
  DeliveryProjectionService: vi.fn().mockImplementation(() => ({
    ensureCurrent: ensureCurrentMock,
    listRecords: listRecordsMock,
    getRecord: getRecordMock,
  })),
}));

const app = express();
app.use(express.json());
app.use('/api/v1/delivery/projects/:projectId/graphql', router);

const projectId = '550e8400-e29b-41d4-a716-446655440000';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

describe('Delivery GraphQL routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initMock.mockResolvedValue(undefined);
    ensureCurrentMock.mockResolvedValue({
      projectId,
      branch: 'main',
      revision: 'rev-1',
      recordCount: 1,
      lastProjectedAt: new Date('2026-03-15T12:00:00.000Z'),
    });
    listCollectionsMock.mockResolvedValue([{ id: 'post', label: 'Posts', contentType: 'post', path: 'content/posts' }]);
    getContentTypeMock.mockResolvedValue({
      $schema: 'content-type-v1',
      $id: 'post',
      name: 'post',
      plural: 'posts',
      label: 'Post',
      labelPlural: 'Posts',
      fields: [],
    });
    findUniqueMock.mockResolvedValue({
      id: projectId,
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
      settings: {
        requireDeliveryApiKey: true,
        deliveryApiKeyHash: hashKey('del_valid'),
      },
    });
    listRecordsMock.mockResolvedValue({
      data: [
        { $id: 'published', $type: 'post', $status: 'published' },
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
    getRecordMock.mockResolvedValue({
      $id: 'published',
      $type: 'post',
      $status: 'published',
    });
  });

  it('requires delivery API key when enabled', async () => {
    const response = await request(app)
      .post(`/api/v1/delivery/projects/${projectId}/graphql`)
      .send({ query: '{ contentTypes { id } }' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('MISSING_DELIVERY_KEY');
  });

  it('returns published records only', async () => {
    const response = await request(app)
      .post(`/api/v1/delivery/projects/${projectId}/graphql`)
      .set('x-oricms-delivery-key', 'del_valid')
      .send({
        query: 'query($type: String!) { records(type: $type) { records { id } meta { pagination { total } } } }',
        variables: { type: 'post' },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.records.records).toHaveLength(1);
    expect(response.body.data.records.records[0].id).toBe('published');
    expect(response.body.meta.queryHash).toBeTypeOf('string');
    expect(response.body.meta.executionMs).toBeTypeOf('number');
  });

  it('returns 304 with matching if-none-match', async () => {
    const first = await request(app)
      .post(`/api/v1/delivery/projects/${projectId}/graphql`)
      .set('x-oricms-delivery-key', 'del_valid')
      .send({ query: '{ contentTypes { id } }' });

    expect(first.status).toBe(200);
    expect(first.headers.etag).toBeTruthy();

    const second = await request(app)
      .post(`/api/v1/delivery/projects/${projectId}/graphql`)
      .set('x-oricms-delivery-key', 'del_valid')
      .set('if-none-match', first.headers.etag)
      .send({ query: '{ contentTypes { id } }' });

    expect(second.status).toBe(304);
  });

  it('rejects overly long graphql query', async () => {
    const response = await request(app)
      .post(`/api/v1/delivery/projects/${projectId}/graphql`)
      .set('x-oricms-delivery-key', 'del_valid')
      .send({
        query: `query { contentTypes { id } }\n#${'x'.repeat(21000)}`,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns delivery graphql schema sdl when key is valid', async () => {
    const response = await request(app)
      .get(`/api/v1/delivery/projects/${projectId}/graphql/schema`)
      .set('x-oricms-delivery-key', 'del_valid');

    expect(response.status).toBe(200);
    expect(response.text).toContain('type DeliveryQuery');
    expect(response.text).toContain('type DeliveryCollectionEntry');
    expect(response.headers.etag).toBeTruthy();
  });

  it('returns delivery graphql introspection when key is valid', async () => {
    const response = await request(app)
      .get(`/api/v1/delivery/projects/${projectId}/graphql/schema/introspection`)
      .set('x-oricms-delivery-key', 'del_valid');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.__schema).toBeDefined();
    expect(response.headers.etag).toBeTruthy();
  });

  it('supports persisted query id allowlist for delivery', async () => {
    const query = '{ contentTypes { id name } }';
    const queryHash = hashKey(query);
    findUniqueMock.mockResolvedValueOnce({
      id: projectId,
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
      settings: {
        requireDeliveryApiKey: true,
        deliveryApiKeyHash: hashKey('del_valid'),
        graphql: {
          deliveryPersistedQueries: {
            enabled: true,
            requirePersistedOnly: true,
            queries: [
              {
                id: 'pq-content-types',
                query,
                sha256: queryHash,
                operationName: null,
              },
            ],
          },
        },
      },
    });

    const response = await request(app)
      .post(`/api/v1/delivery/projects/${projectId}/graphql`)
      .set('x-oricms-delivery-key', 'del_valid')
      .send({
        persistedQueryId: 'pq-content-types',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.contentTypes).toHaveLength(1);
  });

  it('rejects non-allowlisted raw query when persisted allowlist is enabled', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: projectId,
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
      settings: {
        requireDeliveryApiKey: true,
        deliveryApiKeyHash: hashKey('del_valid'),
        graphql: {
          deliveryPersistedQueries: {
            enabled: true,
            requirePersistedOnly: false,
            queries: [
              {
                id: 'pq-content-types',
                query: '{ contentTypes { id } }',
                sha256: hashKey('{ contentTypes { id } }'),
              },
            ],
          },
        },
      },
    });

    const response = await request(app)
      .post(`/api/v1/delivery/projects/${projectId}/graphql`)
      .set('x-oricms-delivery-key', 'del_valid')
      .send({
        query: '{ records(type: "post") { records { id } } }',
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PERSISTED_QUERY_NOT_ALLOWED');
  });
});
