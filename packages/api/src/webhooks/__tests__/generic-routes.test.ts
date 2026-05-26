import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';

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

import genericRouter from '../generic-routes';

const app = express();
app.use(express.json());
app.use('/api/v1/webhooks', genericRouter);

function buildHmacSignature(secret: string, payload: unknown): string {
  const body = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return `sha256=${hmac}`;
}

describe('Generic webhook routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectFindUniqueMock.mockResolvedValue({
      id: 'project-1',
      repoUrl: 'https://github.com/example/repo.git',
      webhookSecret: 'my-secret',
    });
    buildCreateMock.mockResolvedValue({ id: 'build-1', status: 'pending' });
  });

  it('accepts valid HMAC-SHA256 signature', async () => {
    const payload = { branch: 'main', commit: 'abcdef1234567' };
    const response = await request(app)
      .post('/api/v1/webhooks/generic/project-1')
      .set('x-webhook-secret', buildHmacSignature('my-secret', payload))
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.buildId).toBe('build-1');
  });

  it('rejects invalid HMAC-SHA256 signature', async () => {
    const payload = { branch: 'main', commit: 'abcdef1234567' };
    const response = await request(app)
      .post('/api/v1/webhooks/generic/project-1')
      .set('x-webhook-secret', 'sha256=invalidhex')
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_WEBHOOK_SECRET');
  });

  it('rejects missing signature when webhookSecret is configured', async () => {
    const payload = { branch: 'main', commit: 'abcdef1234567' };
    const response = await request(app)
      .post('/api/v1/webhooks/generic/project-1')
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_WEBHOOK_SECRET');
  });

  it('accepts request without signature when no webhookSecret is configured', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      id: 'project-1',
      repoUrl: 'https://github.com/example/repo.git',
      webhookSecret: null,
    });

    const payload = { branch: 'main', commit: 'abcdef1234567' };
    const response = await request(app)
      .post('/api/v1/webhooks/generic/project-1')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('rejects signature with wrong secret', async () => {
    const payload = { branch: 'main', commit: 'abcdef1234567' };
    const response = await request(app)
      .post('/api/v1/webhooks/generic/project-1')
      .set('x-webhook-secret', buildHmacSignature('wrong-secret', payload))
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_WEBHOOK_SECRET');
  });

  it('accepts raw hex signature without sha256= prefix', async () => {
    const payload = { branch: 'main', commit: 'abcdef1234567' };
    const rawHex = crypto.createHmac('sha256', 'my-secret').update(JSON.stringify(payload), 'utf8').digest('hex');

    const response = await request(app)
      .post('/api/v1/webhooks/generic/project-1')
      .set('x-webhook-secret', rawHex)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
