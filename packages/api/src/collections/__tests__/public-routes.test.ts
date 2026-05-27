import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import router from '../public-routes';

const {
  findUniqueMock,
  ensureCurrentMock,
  listRecordsMock,
  getRecordMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  ensureCurrentMock: vi.fn(),
  listRecordsMock: vi.fn(),
  getRecordMock: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: findUniqueMock,
    },
  },
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
app.use('/api/v1/delivery/projects/:projectId/collections', router);

const projectId = '550e8400-e29b-41d4-a716-446655440000';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

describe('Public Collections Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCurrentMock.mockResolvedValue({
      projectId,
      branch: 'main',
      revision: 'abc123',
      recordCount: 1,
      lastProjectedAt: new Date('2026-03-15T12:00:00.000Z'),
    });
  });

  it('requires delivery API key when enabled', async () => {
    findUniqueMock.mockResolvedValue({
      id: projectId,
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
      settings: {
        requireDeliveryApiKey: true,
        deliveryApiKeyHash: hashKey('del_valid'),
      },
    });

    const response = await request(app)
      .get(`/api/v1/delivery/projects/${projectId}/collections/posts`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('MISSING_DELIVERY_KEY');
  });

  it('returns only published records in list endpoint', async () => {
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
        { $id: 'published', $type: 'posts', $status: 'published' },
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

    const response = await request(app)
      .get(`/api/v1/delivery/projects/${projectId}/collections/posts`)
      .set('x-oricms-delivery-key', 'del_valid');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.data).toHaveLength(1);
    expect(response.body.data.data[0].$id).toBe('published');
  });

  it('returns 404 for unpublished single record', async () => {
    findUniqueMock.mockResolvedValue({
      id: projectId,
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
      settings: {
        requireDeliveryApiKey: true,
        deliveryApiKeyHash: hashKey('del_valid'),
      },
    });

    getRecordMock.mockResolvedValue(null);

    const response = await request(app)
      .get(`/api/v1/delivery/projects/${projectId}/collections/posts/draft-post`)
      .set('x-oricms-delivery-key', 'del_valid');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 503 when delivery key is required but not configured', async () => {
    findUniqueMock.mockResolvedValue({
      id: projectId,
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
      settings: {
        requireDeliveryApiKey: true,
      },
    });

    const response = await request(app)
      .get(`/api/v1/delivery/projects/${projectId}/collections/posts`)
      .set('x-oricms-delivery-key', 'del_valid');

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DELIVERY_KEY_NOT_CONFIGURED');
  });

  it('returns ETag and 304 for unchanged collection list requests', async () => {
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
        { $id: 'published', $type: 'posts', $status: 'published' },
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

    const first = await request(app)
      .get(`/api/v1/delivery/projects/${projectId}/collections/posts`)
      .set('x-oricms-delivery-key', 'del_valid');

    expect(first.status).toBe(200);
    expect(first.headers.etag).toBeTruthy();
    expect(first.headers['cache-control']).toContain('max-age');

    const second = await request(app)
      .get(`/api/v1/delivery/projects/${projectId}/collections/posts`)
      .set('x-oricms-delivery-key', 'del_valid')
      .set('if-none-match', first.headers.etag);

    expect(second.status).toBe(304);
  });
});
