import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  projectFindUniqueMock,
  buildFindManyMock,
  buildCountMock,
  buildFindFirstMock,
  buildCreateMock,
  buildUpdateMock,
  buildGroupByMock,
  queueBuildJobMock,
} = vi.hoisted(() => ({
  projectFindUniqueMock: vi.fn(),
  buildFindManyMock: vi.fn(),
  buildCountMock: vi.fn(),
  buildFindFirstMock: vi.fn(),
  buildCreateMock: vi.fn(),
  buildUpdateMock: vi.fn(),
  buildGroupByMock: vi.fn(),
  queueBuildJobMock: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: projectFindUniqueMock,
    },
    build: {
      findMany: buildFindManyMock,
      count: buildCountMock,
      findFirst: buildFindFirstMock,
      create: buildCreateMock,
      update: buildUpdateMock,
      groupBy: buildGroupByMock,
    },
  },
}));

vi.mock('../../resources/service', () => ({
  RESOURCE_COLLECTION_IDS: {
    builds: 'builds.project',
  },
}));

vi.mock('../../webhooks/build-queue', () => ({
  queueBuildJob: (...args: unknown[]) => queueBuildJobMock(...args),
}));

import router from '../routes';

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
app.use('/api/v1/projects/:projectId/builds', router);

describe('Build routes', () => {
  const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
  const BUILD_ID = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    vi.clearAllMocks();
    projectFindUniqueMock.mockResolvedValue({
      id: PROJECT_ID,
      repoUrl: 'https://github.com/oricms/example.git',
    });
    buildFindManyMock.mockResolvedValue([
      {
        id: BUILD_ID,
        projectId: PROJECT_ID,
        status: 'running',
        branch: 'main',
        commit: 'abc123',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    buildCountMock.mockResolvedValue(2);
    buildFindFirstMock.mockResolvedValue({
      id: BUILD_ID,
      projectId: PROJECT_ID,
      status: 'running',
      branch: 'main',
      commit: 'abc123',
      completedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    buildCreateMock.mockResolvedValue({
      id: BUILD_ID,
      projectId: PROJECT_ID,
      status: 'pending',
      branch: 'staging',
      commit: 'def456',
    });
    buildUpdateMock.mockResolvedValue({
      id: BUILD_ID,
      projectId: PROJECT_ID,
      status: 'cancelled',
      branch: 'main',
      commit: 'abc123',
      completedAt: new Date('2026-01-01T01:00:00.000Z'),
    });
    buildGroupByMock.mockResolvedValue([
      { status: 'pending', _count: { status: 1 } },
      { status: 'running', _count: { status: 2 } },
      { status: 'success', _count: { status: 3 } },
    ]);
    queueBuildJobMock.mockResolvedValue(undefined);
  });

  it('lists builds with resource collection metadata', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${PROJECT_ID}/builds?status=running&limit=10&offset=5`);

    expect(response.status).toBe(200);
    expect(buildFindManyMock).toHaveBeenCalledWith({
      where: { projectId: PROJECT_ID, status: 'running' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      skip: 5,
    });
    expect(buildCountMock).toHaveBeenCalledWith({
      where: { projectId: PROJECT_ID, status: 'running' },
    });
    expect(response.body.data.resourceCollectionId).toBe('builds.project');
    expect(response.body.data.builds[0].resourceCollectionId).toBe('builds.project');
    expect(response.body.data.pagination).toMatchObject({
      total: 2,
      limit: 10,
      offset: 5,
      hasMore: false,
    });
  });

  it('returns build details with resource collection metadata', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${PROJECT_ID}/builds/${BUILD_ID}`);

    expect(response.status).toBe(200);
    expect(buildFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: BUILD_ID,
        projectId: PROJECT_ID,
      },
    });
    expect(response.body.data.build.id).toBe(BUILD_ID);
    expect(response.body.data.build.resourceCollectionId).toBe('builds.project');
  });

  it('triggers a manual build and queues the build job', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/builds`)
      .send({ branch: 'staging', commit: 'def456' });

    expect(response.status).toBe(200);
    expect(projectFindUniqueMock).toHaveBeenCalledWith({
      where: { id: PROJECT_ID },
    });
    expect(buildCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: PROJECT_ID,
        status: 'pending',
        branch: 'staging',
        commit: 'def456',
        commitMessage: 'Manual build trigger',
        commitAuthor: 'test@example.com',
        triggeredBy: 'manual',
        startedAt: expect.any(Date),
      }),
    });
    expect(queueBuildJobMock).toHaveBeenCalledWith(BUILD_ID, PROJECT_ID, {
      branch: 'staging',
      commit: 'def456',
      repoUrl: 'https://github.com/oricms/example.git',
    });
    expect(response.body.data.message).toBe('Build triggered successfully');
  });

  it('returns 404 when triggering a build for a missing project', async () => {
    projectFindUniqueMock.mockResolvedValueOnce(null);

    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/builds`)
      .send({ branch: 'main' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PROJECT_NOT_FOUND');
    expect(buildCreateMock).not.toHaveBeenCalled();
    expect(queueBuildJobMock).not.toHaveBeenCalled();
  });

  it('cancels a pending build', async () => {
    buildFindFirstMock.mockResolvedValueOnce({
      id: BUILD_ID,
      projectId: PROJECT_ID,
      status: 'pending',
      branch: 'main',
      commit: 'abc123',
      completedAt: null,
    });

    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/builds/${BUILD_ID}/cancel`);

    expect(response.status).toBe(200);
    expect(buildUpdateMock).toHaveBeenCalledWith({
      where: { id: BUILD_ID },
      data: {
        status: 'cancelled',
        completedAt: expect.any(Date),
      },
    });
    expect(response.body.data.message).toBe('Build cancelled');
  });

  it('rejects cancelling a completed build', async () => {
    buildFindFirstMock.mockResolvedValueOnce({
      id: BUILD_ID,
      projectId: PROJECT_ID,
      status: 'success',
      branch: 'main',
      commit: 'abc123',
      completedAt: new Date('2026-01-01T01:00:00.000Z'),
    });

    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/builds/${BUILD_ID}/cancel`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CANNOT_CANCEL');
    expect(buildUpdateMock).not.toHaveBeenCalled();
  });

  it('updates a build status and stamps terminal completion', async () => {
    buildUpdateMock.mockResolvedValueOnce({
      id: BUILD_ID,
      projectId: PROJECT_ID,
      status: 'success',
      branch: 'main',
      commit: 'abc123',
      logs: 'done',
      duration: 1200,
      outputUrl: 'https://example.com/build-output',
      completedAt: new Date('2026-01-01T01:00:00.000Z'),
    });

    const response = await request(app)
      .patch(`/api/v1/projects/${PROJECT_ID}/builds/${BUILD_ID}`)
      .send({
        status: 'success',
        logs: 'done',
        duration: 1200,
        outputUrl: 'https://example.com/build-output',
      });

    expect(response.status).toBe(200);
    expect(buildUpdateMock).toHaveBeenCalledWith({
      where: { id: BUILD_ID },
      data: {
        status: 'success',
        logs: 'done',
        duration: 1200,
        outputUrl: 'https://example.com/build-output',
        completedAt: expect.any(Date),
      },
    });
    expect(response.body.data.build.status).toBe('success');
  });

  it('returns a build summary with aggregate counts', async () => {
    buildFindFirstMock.mockResolvedValueOnce({
      id: BUILD_ID,
      projectId: PROJECT_ID,
      status: 'running',
      branch: 'main',
      commit: 'abc123',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const response = await request(app)
      .get(`/api/v1/projects/${PROJECT_ID}/builds/status/summary`);

    expect(response.status).toBe(200);
    expect(buildGroupByMock).toHaveBeenCalledWith({
      by: ['status'],
      where: { projectId: PROJECT_ID },
      _count: {
        status: true,
      },
    });
    expect(response.body.data.latestBuild.id).toBe(BUILD_ID);
    expect(response.body.data.counts).toEqual({
      pending: 1,
      running: 2,
      success: 3,
      failed: 0,
      cancelled: 0,
      total: 6,
    });
  });
});
