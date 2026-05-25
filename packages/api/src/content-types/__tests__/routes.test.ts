import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  resolveWorkspaceMock: vi.fn(),
  listDefinitionsMock: vi.fn(),
  readDefinitionMock: vi.fn(),
  contentTypeExistsMock: vi.fn(),
  createContentTypeMock: vi.fn(),
  updateContentTypeMock: vi.fn(),
  deleteContentTypeMock: vi.fn(),
}));

vi.mock('../route-support', async () => {
  const actual = await vi.importActual<typeof import('../route-support')>('../route-support');
  return {
    ...actual,
    resolveContentTypesWorkspace: (...args: unknown[]) => state.resolveWorkspaceMock(...args),
    listContentTypeDefinitions: (...args: unknown[]) => state.listDefinitionsMock(...args),
    readContentTypeDefinition: (...args: unknown[]) => state.readDefinitionMock(...args),
    contentTypeExists: (...args: unknown[]) => state.contentTypeExistsMock(...args),
  };
});

vi.mock('../../application/content-types/create-content-type', () => ({
  createContentType: (...args: unknown[]) => state.createContentTypeMock(...args),
}));

vi.mock('../../application/content-types/update-content-type', () => ({
  updateContentType: (...args: unknown[]) => state.updateContentTypeMock(...args),
}));

vi.mock('../../application/content-types/delete-content-type', () => ({
  deleteContentType: (...args: unknown[]) => state.deleteContentTypeMock(...args),
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
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
app.use('/api/v1/projects/:projectId/content-types', router);

describe('content type routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolveWorkspaceMock.mockResolvedValue({
      workspacePath: '/tmp/project-1/repo',
      gitService: { name: 'git-service' },
    });
    state.listDefinitionsMock.mockResolvedValue([
      {
        $schema: 'content-type-v1',
        $id: 'blog_post',
        name: 'blog_post',
        label: 'Blog Post',
        plural: 'blog-posts',
        labelPlural: 'Blog Posts',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      },
    ]);
    state.readDefinitionMock.mockResolvedValue({
      $schema: 'content-type-v1',
      $id: 'blog_post',
      name: 'blog_post',
      label: 'Blog Post',
      plural: 'blog-posts',
      labelPlural: 'Blog Posts',
      fields: [{ key: 'title', type: 'string', label: 'Title' }],
    });
    state.contentTypeExistsMock.mockResolvedValue(false);
    state.createContentTypeMock.mockResolvedValue(undefined);
    state.updateContentTypeMock.mockResolvedValue(undefined);
    state.deleteContentTypeMock.mockResolvedValue(undefined);
  });

  it('lists content types with attached resource links', async () => {
    const response = await request(app).get('/api/v1/projects/project-1/content-types');

    expect(response.status).toBe(200);
    expect(response.body.data.contentTypes[0]).toMatchObject({
      name: 'blog_post',
      resource: expect.any(Object),
    });
  });

  it('creates a content type from normalized request data', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/content-types')
      .send({
        name: 'blog_post',
        plural: 'blog-posts',
        label: 'Blog Post',
        labelPlural: 'Blog Posts',
        fields: [{ name: 'title', type: 'string' }],
      });

    expect(response.status).toBe(201);
    expect(state.createContentTypeMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: 'blog_post',
        fields: [expect.objectContaining({ key: 'title', label: 'title' })],
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('returns not found when deleting an unknown content type', async () => {
    state.readDefinitionMock.mockResolvedValueOnce(null);

    const response = await request(app).delete('/api/v1/projects/project-1/content-types/missing-type');

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe('Content type not found');
  });
});
