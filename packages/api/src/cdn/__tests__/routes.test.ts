import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  cdnConfigFindUniqueMock,
  cdnConfigUpsertMock,
  cdnConfigDeleteMock,
  projectFindUniqueMock,
  buildFindFirstMock,
  cdnExportCreateMock,
  cdnExportUpdateMock,
  cdnExportFindManyMock,
  cdnExportCountMock,
  cdnExportFindFirstMock,
  runBackgroundTaskMock,
  exportMock,
} = vi.hoisted(() => ({
  cdnConfigFindUniqueMock: vi.fn(),
  cdnConfigUpsertMock: vi.fn(),
  cdnConfigDeleteMock: vi.fn(),
  projectFindUniqueMock: vi.fn(),
  buildFindFirstMock: vi.fn(),
  cdnExportCreateMock: vi.fn(),
  cdnExportUpdateMock: vi.fn(),
  cdnExportFindManyMock: vi.fn(),
  cdnExportCountMock: vi.fn(),
  cdnExportFindFirstMock: vi.fn(),
  runBackgroundTaskMock: vi.fn(),
  exportMock: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    cdnConfig: {
      findUnique: cdnConfigFindUniqueMock,
      upsert: cdnConfigUpsertMock,
      delete: cdnConfigDeleteMock,
    },
    project: {
      findUnique: projectFindUniqueMock,
    },
    build: {
      findFirst: buildFindFirstMock,
    },
    cdnExport: {
      create: cdnExportCreateMock,
      update: cdnExportUpdateMock,
      findMany: cdnExportFindManyMock,
      count: cdnExportCountMock,
      findFirst: cdnExportFindFirstMock,
    },
  },
}));

vi.mock('../../lib/api-services', () => ({
  apiServices: {
    runBackgroundTask: (...args: unknown[]) => runBackgroundTaskMock(...args),
  },
}));

vi.mock('../../lib/crypto', () => ({
  encrypt: vi.fn((value: string) => `enc:${value}`),
  decrypt: vi.fn((value: string) => value.replace(/^enc:/, '')),
}));

vi.mock('../service', () => ({
  CDNExportService: vi.fn().mockImplementation(() => ({
    export: exportMock,
  })),
}));

import router from '../routes';

const app = express();
app.use(express.json());
app.use('/api/v1/projects/:projectId/cdn', router);

describe('CDN routes', () => {
  const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
  const BUILD_ID = '22222222-2222-4222-8222-222222222222';
  const EXPORT_ID = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    vi.clearAllMocks();
    cdnConfigFindUniqueMock.mockResolvedValue({
      projectId: PROJECT_ID,
      provider: 's3',
      bucket: 'oricms-prod',
      encryptedAccessKey: 'enc:access-key',
      encryptedSecretKey: 'enc:secret-key',
      region: 'us-east-1',
      endpoint: null,
      baseUrl: 'https://cdn.example.com',
    });
    cdnConfigUpsertMock.mockResolvedValue({
      provider: 's3',
      bucket: 'oricms-prod',
      region: 'us-east-1',
      endpoint: null,
      baseUrl: 'https://cdn.example.com',
    });
    cdnConfigDeleteMock.mockResolvedValue({});
    projectFindUniqueMock.mockResolvedValue({ id: PROJECT_ID });
    buildFindFirstMock.mockResolvedValue({
      id: BUILD_ID,
      projectId: PROJECT_ID,
      status: 'success',
      outputPath: '/tmp/build-output',
      completedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    cdnExportCreateMock.mockResolvedValue({
      id: EXPORT_ID,
      projectId: PROJECT_ID,
      buildId: BUILD_ID,
      status: 'pending',
    });
    cdnExportUpdateMock.mockResolvedValue({});
    cdnExportFindManyMock.mockResolvedValue([
      {
        id: EXPORT_ID,
        projectId: PROJECT_ID,
        status: 'completed',
      },
    ]);
    cdnExportCountMock.mockResolvedValue(1);
    cdnExportFindFirstMock.mockResolvedValue({
      id: EXPORT_ID,
      projectId: PROJECT_ID,
      status: 'completed',
    });
    exportMock.mockReturnValue(new Promise(() => {}));
    runBackgroundTaskMock.mockImplementation(() => {});
  });

  it('returns sanitized CDN config', async () => {
    const response = await request(app).get(`/api/v1/projects/${PROJECT_ID}/cdn/config`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      provider: 's3',
      bucket: 'oricms-prod',
      region: 'us-east-1',
      endpoint: null,
      baseUrl: 'https://cdn.example.com',
      isConfigured: true,
    });
    expect(JSON.stringify(response.body)).not.toContain('encryptedAccessKey');
  });

  it('upserts CDN config for an existing project', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/cdn/config`)
      .send({
        provider: 's3',
        bucket: 'oricms-prod',
        accessKeyId: 'access-key',
        secretAccessKey: 'secret-key',
        region: 'us-east-1',
        baseUrl: 'https://cdn.example.com',
      });

    expect(response.status).toBe(200);
    expect(projectFindUniqueMock).toHaveBeenCalledWith({
      where: { id: PROJECT_ID },
    });
    expect(cdnConfigUpsertMock).toHaveBeenCalledWith({
      where: { projectId: PROJECT_ID },
      update: expect.objectContaining({
        encryptedAccessKey: 'enc:access-key',
        encryptedSecretKey: 'enc:secret-key',
      }),
      create: expect.objectContaining({
        projectId: PROJECT_ID,
        encryptedAccessKey: 'enc:access-key',
        encryptedSecretKey: 'enc:secret-key',
      }),
    });
  });

  it('starts a CDN export from an explicit build and schedules background work', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/cdn/export`)
      .send({ buildId: BUILD_ID, destinationPrefix: 'deploys/staging' });

    expect(response.status).toBe(200);
    expect(buildFindFirstMock).toHaveBeenCalledWith({
      where: { id: BUILD_ID, projectId: PROJECT_ID },
    });
    expect(cdnExportCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: PROJECT_ID,
        buildId: BUILD_ID,
        status: 'pending',
        sourcePath: '/tmp/build-output',
        destinationPrefix: 'deploys/staging',
        startedAt: expect.any(Date),
      }),
    });
    expect(cdnExportUpdateMock).toHaveBeenCalledWith({
      where: { id: EXPORT_ID },
      data: { status: 'uploading' },
    });
    expect(exportMock).toHaveBeenCalledWith({
      sourcePath: '/tmp/build-output',
      destinationPrefix: 'deploys/staging',
      onProgress: expect.any(Function),
    });
    expect(runBackgroundTaskMock).toHaveBeenCalledWith('cdn-export', expect.any(Promise));
    expect(response.body.data).toEqual({
      exportId: EXPORT_ID,
      status: 'pending',
      message: 'Export started',
    });
  });

  it('returns a bad request when no successful build output exists', async () => {
    buildFindFirstMock.mockResolvedValueOnce(null);

    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/cdn/export`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('NO_BUILD_OUTPUT');
    expect(cdnExportCreateMock).not.toHaveBeenCalled();
  });

  it('lists CDN exports with pagination', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${PROJECT_ID}/cdn/exports?limit=10&offset=5`);

    expect(response.status).toBe(200);
    expect(cdnExportFindManyMock).toHaveBeenCalledWith({
      where: { projectId: PROJECT_ID },
      orderBy: { createdAt: 'desc' },
      take: 10,
      skip: 5,
    });
    expect(response.body.data.pagination).toEqual({
      total: 1,
      limit: 10,
      offset: 5,
      hasMore: false,
    });
  });

  it('returns a single export detail', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${PROJECT_ID}/cdn/exports/${EXPORT_ID}`);

    expect(response.status).toBe(200);
    expect(cdnExportFindFirstMock).toHaveBeenCalledWith({
      where: { id: EXPORT_ID, projectId: PROJECT_ID },
    });
    expect(response.body.data.export.id).toBe(EXPORT_ID);
  });

  it('removes CDN configuration', async () => {
    const response = await request(app)
      .delete(`/api/v1/projects/${PROJECT_ID}/cdn/config`);

    expect(response.status).toBe(200);
    expect(cdnConfigDeleteMock).toHaveBeenCalledWith({
      where: { projectId: PROJECT_ID },
    });
    expect(response.body.data.message).toBe('CDN configuration removed');
  });
});
