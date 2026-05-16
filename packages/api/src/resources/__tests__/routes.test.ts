import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  getUserRoleMock,
  listResourceCollectionsMock,
  getResourceCollectionMock,
  getResourceSchemaMock,
  listRecordsMock,
  getRecordMock,
} = vi.hoisted(() => ({
  getUserRoleMock: vi.fn(),
  listResourceCollectionsMock: vi.fn(),
  getResourceCollectionMock: vi.fn(),
  getResourceSchemaMock: vi.fn(),
  listRecordsMock: vi.fn(),
  getRecordMock: vi.fn(),
}));

vi.mock('../../permissions/middleware', () => ({
  getUserRole: (...args: unknown[]) => getUserRoleMock(...args),
}));

vi.mock('../service', () => ({
  ResourceService: vi.fn().mockImplementation(() => ({
    listResourceCollections: (...args: unknown[]) => listResourceCollectionsMock(...args),
    getResourceCollection: (...args: unknown[]) => getResourceCollectionMock(...args),
    getResourceSchema: (...args: unknown[]) => getResourceSchemaMock(...args),
    listRecords: (...args: unknown[]) => listRecordsMock(...args),
    getRecord: (...args: unknown[]) => getRecordMock(...args),
  })),
}));

import router from '../routes';

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as express.Request & { userId?: string }).userId = 'user-1';
  next();
});
app.use('/api/v1/projects/:projectId/resources', router);

describe('Resources routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserRoleMock.mockResolvedValue('owner');
    listResourceCollectionsMock.mockResolvedValue([
      {
        id: 'content.posts',
        domain: 'content',
        collectionType: 'user',
        isSystem: false,
        label: 'Posts',
        capabilities: {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
          canPublish: true,
        },
        policySummary: {
          privileged: false,
          schemaEditable: false,
          policyEditable: false,
          recordEditingMode: 'standard',
        },
        source: 'git',
      },
    ]);
    getResourceCollectionMock.mockResolvedValue({
      id: 'content.posts',
      domain: 'content',
      collectionType: 'user',
      isSystem: false,
      label: 'Posts',
      capabilities: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
        canPublish: true,
      },
      policySummary: {
        privileged: false,
        schemaEditable: false,
        policyEditable: false,
        recordEditingMode: 'standard',
      },
      source: 'git',
    });
    getResourceSchemaMock.mockResolvedValue({
      id: 'post',
      label: 'Post',
      kind: 'content-type',
      document: { $id: 'post' },
    });
    listRecordsMock.mockResolvedValue({
      records: [{ id: 'hello-world', label: 'Hello World', status: 'published' }],
      total: 1,
    });
    getRecordMock.mockResolvedValue({
      id: 'hello-world',
      label: 'Hello World',
      status: 'published',
      data: { $id: 'hello-world', title: 'Hello World' },
    });
  });

  it('lists resource collections for a project member', async () => {
    const response = await request(app).get('/api/v1/projects/project-1/resources');

    expect(response.status).toBe(200);
    expect(response.body.data.resources).toHaveLength(1);
    expect(response.body.data.resources[0].id).toBe('content.posts');
  });

  it('lists records for a resource collection', async () => {
    const response = await request(app).get('/api/v1/projects/project-1/resources/content.posts/records');

    expect(response.status).toBe(200);
    expect(listRecordsMock).toHaveBeenCalledWith('content.posts', { page: 1, limit: 20 });
    expect(response.body.data.records[0].id).toBe('hello-world');
  });

  it('returns record detail for a resource collection record', async () => {
    const response = await request(app).get('/api/v1/projects/project-1/resources/content.posts/records/hello-world');

    expect(response.status).toBe(200);
    expect(response.body.data.record.id).toBe('hello-world');
  });
});
