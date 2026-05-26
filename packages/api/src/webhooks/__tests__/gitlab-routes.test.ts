import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';

const { projectFindManyMock, buildCreateMock } = vi.hoisted(() => ({
  projectFindManyMock: vi.fn(),
  buildCreateMock: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
      findMany: projectFindManyMock,
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

import gitlabRouter from '../gitlab-routes';

const app = express();
app.use(express.json());
app.use('/api/v1/webhooks', gitlabRouter);

function buildHmacSignature(secret: string, payload: unknown): string {
  const body = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return `sha256=${hmac}`;
}

describe('GitLab webhook routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectFindManyMock.mockResolvedValue([
      {
        id: 'project-1',
        repoUrl: 'https://gitlab.com/example/repo.git',
        webhookSecret: 'my-secret',
      },
    ]);
    buildCreateMock.mockResolvedValue({ id: 'build-1', status: 'pending' });
  });

  it('accepts valid HMAC-SHA256 signature', async () => {
    const payload = {
      repository: { git_http_url: 'https://gitlab.com/example/repo.git' },
      ref: 'refs/heads/main',
      after: 'abcdef1234567',
      commits: [{ message: 'test', author: { name: 'Test' } }],
    };

    const response = await request(app)
      .post('/api/v1/webhooks/gitlab')
      .set('x-gitlab-event', 'Push Hook')
      .set('x-gitlab-token', buildHmacSignature('my-secret', payload))
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('rejects invalid HMAC-SHA256 signature', async () => {
    const payload = {
      repository: { git_http_url: 'https://gitlab.com/example/repo.git' },
      ref: 'refs/heads/main',
      after: 'abcdef1234567',
      commits: [{ message: 'test', author: { name: 'Test' } }],
    };

    const response = await request(app)
      .post('/api/v1/webhooks/gitlab')
      .set('x-gitlab-event', 'Push Hook')
      .set('x-gitlab-token', 'sha256=invalidhex')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const projectResult = response.body.data.results[0];
    expect(projectResult.triggered).toBe(false);
    expect(projectResult.error).toBe('Invalid token');
  });

  it('rejects missing signature when webhookSecret is configured', async () => {
    const payload = {
      repository: { git_http_url: 'https://gitlab.com/example/repo.git' },
      ref: 'refs/heads/main',
      after: 'abcdef1234567',
      commits: [{ message: 'test', author: { name: 'Test' } }],
    };

    const response = await request(app)
      .post('/api/v1/webhooks/gitlab')
      .set('x-gitlab-event', 'Push Hook')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const projectResult = response.body.data.results[0];
    expect(projectResult.triggered).toBe(false);
    expect(projectResult.error).toBe('Invalid token');
  });

  it('accepts request without signature when no webhookSecret is configured', async () => {
    projectFindManyMock.mockResolvedValueOnce([
      {
        id: 'project-1',
        repoUrl: 'https://gitlab.com/example/repo.git',
        webhookSecret: null,
      },
    ]);

    const payload = {
      repository: { git_http_url: 'https://gitlab.com/example/repo.git' },
      ref: 'refs/heads/main',
      after: 'abcdef1234567',
      commits: [{ message: 'test', author: { name: 'Test' } }],
    };

    const response = await request(app)
      .post('/api/v1/webhooks/gitlab')
      .set('x-gitlab-event', 'Push Hook')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const projectResult = response.body.data.results[0];
    expect(projectResult.triggered).toBe(true);
  });

  it('rejects signature with wrong secret', async () => {
    const payload = {
      repository: { git_http_url: 'https://gitlab.com/example/repo.git' },
      ref: 'refs/heads/main',
      after: 'abcdef1234567',
      commits: [{ message: 'test', author: { name: 'Test' } }],
    };

    const response = await request(app)
      .post('/api/v1/webhooks/gitlab')
      .set('x-gitlab-event', 'Push Hook')
      .set('x-gitlab-token', buildHmacSignature('wrong-secret', payload))
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const projectResult = response.body.data.results[0];
    expect(projectResult.triggered).toBe(false);
    expect(projectResult.error).toBe('Invalid token');
  });

  it('accepts raw hex signature without sha256= prefix', async () => {
    const payload = {
      repository: { git_http_url: 'https://gitlab.com/example/repo.git' },
      ref: 'refs/heads/main',
      after: 'abcdef1234567',
      commits: [{ message: 'test', author: { name: 'Test' } }],
    };

    const rawHex = crypto.createHmac('sha256', 'my-secret').update(JSON.stringify(payload), 'utf8').digest('hex');

    const response = await request(app)
      .post('/api/v1/webhooks/gitlab')
      .set('x-gitlab-event', 'Push Hook')
      .set('x-gitlab-token', rawHex)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const projectResult = response.body.data.results[0];
    expect(projectResult.triggered).toBe(true);
  });
});
