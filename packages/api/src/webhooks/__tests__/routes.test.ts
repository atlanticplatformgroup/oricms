import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { projectFindUniqueMock, buildCreateMock } = vi.hoisted(() => ({
  projectFindUniqueMock: vi.fn(),
  buildCreateMock: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: projectFindUniqueMock,
      findMany: vi.fn().mockResolvedValue([]),
    },
    build: {
      create: buildCreateMock,
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    branchEnvironmentMapping: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('../build-queue', () => ({
  queueBuildJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../dispatch', () => ({
  triggerMappedEnvironmentActions: vi.fn().mockResolvedValue({ triggered: false, reason: 'No branch mapping' }),
}));

import router from '../routes';

const app = express();
app.use(express.json());
app.use('/api/v1/webhooks', router);

describe('Webhooks routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectFindUniqueMock.mockResolvedValue({ id: 'project-1', repoUrl: 'https://github.com/example/repo.git' });
    buildCreateMock.mockResolvedValue({ id: 'build-1', status: 'pending' });
  });

  it('responds to github ping', async () => {
    const response = await request(app)
      .post('/api/v1/webhooks/github')
      .set('x-github-event', 'ping')
      .send({ zen: 'keep it logically awesome' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { message: 'Pong' } });
  });

  it('returns missing branch for generic webhook without branch or ref', async () => {
    const response = await request(app)
      .post('/api/v1/webhooks/generic/project-1')
      .send({ commit: 'abcdef1' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MISSING_BRANCH');
  });

  it('returns project not found for generic webhook when project is missing', async () => {
    projectFindUniqueMock.mockResolvedValueOnce(null);
    const response = await request(app)
      .post('/api/v1/webhooks/generic/project-1')
      .send({ branch: 'main', commit: 'abcdef1' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PROJECT_NOT_FOUND');
  });
});
