import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  projectFindUniqueMock,
  projectCreateMock,
  projectUpdateMock,
  projectDeleteMock,
  projectMemberFindManyMock,
  projectMemberFindUniqueMock,
  gitInitRepoMock,
  configBootstrapMock,
  configSaveMock,
  runBackgroundTaskMock,
} = vi.hoisted(() => ({
  projectFindUniqueMock: vi.fn(),
  projectCreateMock: vi.fn(),
  projectUpdateMock: vi.fn(),
  projectDeleteMock: vi.fn(),
  projectMemberFindManyMock: vi.fn(),
  projectMemberFindUniqueMock: vi.fn(),
  gitInitRepoMock: vi.fn(),
  configBootstrapMock: vi.fn(),
  configSaveMock: vi.fn(),
  runBackgroundTaskMock: vi.fn(),
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireOwnerOrAdmin: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: projectFindUniqueMock,
      create: projectCreateMock,
      update: projectUpdateMock,
      delete: projectDeleteMock,
    },
    projectMember: {
      findMany: projectMemberFindManyMock,
      findUnique: projectMemberFindUniqueMock,
    },
  },
}));

vi.mock('../../git/service', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    initRepo: gitInitRepoMock,
  })),
}));

vi.mock('../../lib/api-services', () => ({
  apiServices: {
    runBackgroundTask: (...args: unknown[]) => runBackgroundTaskMock(...args),
  },
}));

vi.mock('../config-service', () => ({
  ProjectConfigService: vi.fn().mockImplementation(() => ({
    bootstrap: configBootstrapMock,
    save: configSaveMock,
  })),
}));

vi.mock('../../locks/middleware', () => ({
  ensureResourceNotLocked: vi.fn().mockResolvedValue(true),
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
app.use('/api/v1/projects', router);

describe('Projects routes', () => {
  const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    projectMemberFindManyMock.mockResolvedValue([
      {
        role: 'owner',
        project: { id: 'project-1', name: 'Example Project', slug: 'example-project' },
      },
    ]);
    projectMemberFindUniqueMock.mockResolvedValue({ role: 'owner' });
    projectFindUniqueMock.mockResolvedValue({
      settings: { contentRoot: 'content' },
    });
    projectCreateMock.mockResolvedValue({
      id: 'project-1',
      name: 'Example Project',
      slug: 'example-project',
      repoUrl: null,
      repoProvider: 'github',
      description: 'Example project',
      settings: { contentRoot: 'content' },
    });
    projectUpdateMock.mockResolvedValue({
      id: 'project-1',
      name: 'Example Project',
      description: 'Updated project',
      settings: { contentRoot: 'content' },
    });
    projectDeleteMock.mockResolvedValue({});
    gitInitRepoMock.mockResolvedValue(undefined);
    configBootstrapMock.mockResolvedValue(undefined);
    configSaveMock.mockResolvedValue(undefined);
    runBackgroundTaskMock.mockImplementation((_label: string, _task: Promise<unknown>) => {});
  });

  it('lists projects for the current user with membership roles', async () => {
    const response = await request(app).get('/api/v1/projects');

    expect(response.status).toBe(200);
    expect(projectMemberFindManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(response.body.data.projects[0]).toMatchObject({
      id: 'project-1',
      role: 'owner',
    });
  });

  it('creates a project, initializes git when repo url is absent, and queues bootstrap', async () => {
    projectFindUniqueMock.mockResolvedValueOnce(null);

    const response = await request(app)
      .post('/api/v1/projects')
      .send({
        name: 'Example Project',
        slug: 'example-project',
        description: 'Example project',
      });

    expect(response.status).toBe(201);
    expect(projectCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Example Project',
        slug: 'example-project',
        settings: { contentRoot: 'content' },
        members: { create: { userId: 'user-1', role: 'owner' } },
      }),
    });
    expect(gitInitRepoMock).toHaveBeenCalledWith('project-1');
    expect(runBackgroundTaskMock).toHaveBeenCalledWith('project-config-bootstrap', expect.any(Promise));
  });

  it('returns a single project with settings resource collection id', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      id: PROJECT_ID,
      name: 'Example Project',
      _count: { members: 3 },
    });

    const response = await request(app).get(`/api/v1/projects/${PROJECT_ID}`);

    expect(response.status).toBe(200);
    expect(response.body.data.project.id).toBe(PROJECT_ID);
    expect(response.body.data.settingsResourceCollectionId).toBe('settings.project');
  });

  it('updates project settings without starter-specific audit behavior', async () => {
    const response = await request(app)
      .patch(`/api/v1/projects/${PROJECT_ID}`)
      .send({
        settings: {
          contentRoot: 'src/content',
        },
      });

    expect(response.status).toBe(200);
    expect(projectUpdateMock).toHaveBeenCalledWith({
      where: { id: PROJECT_ID },
      data: expect.objectContaining({
        settings: expect.objectContaining({
          contentRoot: 'src/content',
        }),
      }),
    });
    expect(configSaveMock).toHaveBeenCalled();
  });

  it('deletes a project when the current member is an owner', async () => {
    const response = await request(app).delete(`/api/v1/projects/${PROJECT_ID}`);

    expect(response.status).toBe(200);
    expect(projectMemberFindUniqueMock).toHaveBeenCalledWith({
      where: { userId_projectId: { userId: 'user-1', projectId: PROJECT_ID } },
    });
    expect(projectDeleteMock).toHaveBeenCalledWith({ where: { id: PROJECT_ID } });
  });

  it('rejects project deletion for non-owner members', async () => {
    projectMemberFindUniqueMock.mockResolvedValueOnce({ role: 'admin' });

    const response = await request(app).delete(`/api/v1/projects/${PROJECT_ID}`);

    expect(response.status).toBe(403);
    expect(projectDeleteMock).not.toHaveBeenCalled();
  });

});
