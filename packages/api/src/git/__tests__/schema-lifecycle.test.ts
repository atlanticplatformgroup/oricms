import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const {
  saveSchemaMock,
  deleteSchemaMock,
  lifecycleHookErrorClass,
} = vi.hoisted(() => ({
  saveSchemaMock: vi.fn(),
  deleteSchemaMock: vi.fn(),
  lifecycleHookErrorClass: class LifecycleHookError extends Error {},
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  checkPermission: vi.fn(),
}));

vi.mock('../service', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
  })),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: { findUnique: vi.fn().mockResolvedValue({ name: 'Test Project', settings: {} }) },
    projectMember: { findUnique: vi.fn().mockResolvedValue({ role: 'admin' }) },
    auditLog: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock('../../plugins/dispatcher', () => ({
  LifecycleHookError: lifecycleHookErrorClass,
}));

vi.mock('../../application/schemas/save-schema', () => ({
  saveSchema: (...args: unknown[]) => saveSchemaMock(...args),
}));

vi.mock('../../application/schemas/delete-schema', () => ({
  deleteSchema: (...args: unknown[]) => deleteSchemaMock(...args),
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
app.use('/api/v1/projects/:projectId/git', router);

describe('Git schema lifecycle routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveSchemaMock.mockResolvedValue({ path: 'schemas/types/post.json' });
    deleteSchemaMock.mockResolvedValue({ path: 'schemas/types/post.json' });
  });

  it('routes schema saves through the schema application service', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/git/schemas/types/post.json')
      .send({ content: '{"fields":[]}', message: 'Save schema' });

    expect(response.status).toBe(200);
    expect(saveSchemaMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      path: 'schemas/types/post.json',
      actor: expect.objectContaining({ email: 'test@example.com' }),
    }), '{"fields":[]}', 'Save schema', expect.any(Object));
  });

  it('returns lifecycle blocked when schema save is vetoed', async () => {
    saveSchemaMock.mockRejectedValueOnce(new lifecycleHookErrorClass('blocked'));

    const response = await request(app)
      .post('/api/v1/projects/project-1/git/schemas/types/post.json')
      .send({ content: '{"fields":[]}', message: 'Save schema' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('LIFECYCLE_BLOCKED');
    expect(saveSchemaMock).toHaveBeenCalled();
  });

  it('routes schema deletes through the schema application service', async () => {
    const response = await request(app).delete('/api/v1/projects/project-1/git/schemas/types/post.json');

    expect(response.status).toBe(200);
    expect(deleteSchemaMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      path: 'schemas/types/post.json',
      actor: expect.objectContaining({ email: 'test@example.com' }),
    }), expect.any(Object));
  });
});
