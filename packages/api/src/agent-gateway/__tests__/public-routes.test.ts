import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  createAuditLogMock: vi.fn(),
}));

vi.mock('../middleware', () => ({
  authenticateAgentToken: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.projectRole = 'admin';
    req.agentSessionId = 'session-1';
    req.agentAccessConfig = {
      projectId: 'project-1',
      allowedBranches: ['main'],
    } as never;
    req.agentGateway = {
      async getConfigStatus() {
        return { enabled: true };
      },
      async getSessionBootstrap() {
        return { project: { id: 'project-1' } };
      },
      async getContentTypes() {
        return {
          data: [{ name: 'blog-post', fields: [{ key: 'title', type: 'string' }] }],
          metadata: { branch: 'main' },
        };
      },
      async getContentType(id: string) {
        if (id === 'missing-type') {
          return { data: null, metadata: { branch: 'main' } };
        }
        return {
          data: { name: id, fields: [{ key: 'title', type: 'string' }] },
          metadata: { branch: 'main' },
        };
      },
      async getRepositoryStructure() {
        return { data: [], metadata: { branch: 'main' } };
      },
      async getGitHistory() {
        return { data: [{ message: 'fix build', author: 'Codex', date: '2026-03-13T12:00:00.000Z' }], metadata: { branch: 'main' } };
      },
      async getCollectionConfig(name: string) {
        if (name === 'missing') {
          return { data: null, metadata: { branch: 'main' } };
        }
        return { data: { contentType: 'blog-post' }, metadata: { branch: 'main' } };
      },
      async getCollectionEntries(_name: string, options: { page: number; limit: number }) {
        return {
          data: [{ $id: 'entry-1', title: 'Hello' }],
          metadata: { branch: 'main', page: options.page, limit: options.limit },
        };
      },
      async getEntry(_name: string, id: string) {
        if (id === 'missing-entry') {
          return { data: null, metadata: { branch: 'main' } };
        }
        return { data: { $id: id, title: 'Hello' }, metadata: { branch: 'main' } };
      },
      async getRawFile(filePath: string) {
        if (filePath === 'missing.txt') {
          throw new Error('not found');
        }
        return { data: 'file body', metadata: { branch: 'main' } };
      },
    } as never;
    next();
  },
  handleAgentAccessError: vi.fn((res: express.Response, error: unknown) => {
    res.status(500).json({ success: false, error: String(error) });
  }),
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    agentAuditLog: {
      create: (...args: unknown[]) => state.createAuditLogMock(...args),
    },
  },
}));

import router from '../public-routes';

const app = express();
app.use(express.json());
app.use(router);

describe('agent public routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.createAuditLogMock.mockResolvedValue({ id: 'audit-1' });
  });

  it('returns not found for missing schemas', async () => {
    const response = await request(app).get('/v1/schemas/missing-type');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('CONTENT_TYPE_NOT_FOUND');
  });

  it('includes pagination metadata when listing collection entries', async () => {
    const response = await request(app).get('/v1/collections/blog-posts/entries').query({ page: '2', pageSize: '99' });

    expect(response.status).toBe(200);
    expect(response.body.meta.pagination).toEqual({
      page: 2,
      pageSize: 50,
      total: 1,
    });
  });

  it('rejects diagnosis requests for disallowed branches', async () => {
    const response = await request(app)
      .post('/v1/diagnose')
      .send({ scope: 'schema', branch: 'release' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('BRANCH_NOT_ALLOWED');
  });
});
