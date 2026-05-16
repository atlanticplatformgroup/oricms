import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  ensureResourceNotLockedMock: vi.fn(),
  getWorkspaceProjectAndRoleMock: vi.fn(),
  normalizeUiGroupsMock: vi.fn(),
  buildWorkspaceCatalogMock: vi.fn(),
  persistUiGroupsMock: vi.fn(),
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireOwnerOrAdmin: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  getUserRole: vi.fn(),
}));

vi.mock('../../locks/middleware', () => ({
  ensureResourceNotLocked: (...args: unknown[]) => state.ensureResourceNotLockedMock(...args),
}));

vi.mock('../workspace-route-support', async () => {
  const actual = await vi.importActual<typeof import('../workspace-route-support')>('../workspace-route-support');
  return {
    ...actual,
    getWorkspaceProjectAndRole: (...args: unknown[]) => state.getWorkspaceProjectAndRoleMock(...args),
    normalizeUiGroups: (...args: unknown[]) => state.normalizeUiGroupsMock(...args),
    buildWorkspaceCatalog: (...args: unknown[]) => state.buildWorkspaceCatalogMock(...args),
    persistUiGroups: (...args: unknown[]) => state.persistUiGroupsMock(...args),
  };
});

import router from '../workspace-routes';

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

describe('workspace routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.ensureResourceNotLockedMock.mockResolvedValue(true);
    state.getWorkspaceProjectAndRoleMock.mockResolvedValue({
      project: {
        id: 'project-1',
        settings: { uiGroups: [] },
        createdAt: new Date('2026-03-13T10:00:00.000Z'),
        updatedAt: new Date('2026-03-13T11:00:00.000Z'),
      },
      role: 'owner',
    });
    state.normalizeUiGroupsMock.mockReturnValue([]);
    state.buildWorkspaceCatalogMock.mockResolvedValue({
      navigation: {
        uiGroups: [],
      },
    });
    state.persistUiGroupsMock.mockResolvedValue(undefined);
  });

  it('lists workspace ui groups with catalog summaries', async () => {
    state.normalizeUiGroupsMock.mockReturnValue([
      {
        id: 'marketing',
        slug: 'marketing',
        label: 'Marketing',
        order: 0,
        visible: true,
        locked: false,
        capabilities: { canRead: true },
        createdAt: '2026-03-13T10:00:00.000Z',
        updatedAt: '2026-03-13T11:00:00.000Z',
      },
    ]);
    state.buildWorkspaceCatalogMock.mockResolvedValue({
      navigation: {
        uiGroups: [
          {
            group: { id: 'marketing', slug: 'marketing', label: 'Marketing' },
            collectionIds: ['posts'],
          },
        ],
      },
    });

    const response = await request(app).get('/api/v1/projects/project-1/ui-groups');

    expect(response.status).toBe(200);
    expect(response.body.data.uiGroups).toEqual([
      {
        group: { id: 'marketing', slug: 'marketing', label: 'Marketing' },
        collectionIds: ['posts'],
      },
    ]);
  });

  it('creates a ui group and persists the updated settings', async () => {
    const response = await request(app)
      .post('/api/v1/projects/project-1/ui-groups')
      .send({ slug: 'marketing', label: 'Marketing' });

    expect(response.status).toBe(201);
    expect(state.persistUiGroupsMock).toHaveBeenCalledWith(
      'project-1',
      [
        expect.objectContaining({
          id: 'marketing',
          slug: 'marketing',
          label: 'Marketing',
        }),
      ],
      expect.anything(),
    );
  });

  it('returns not found when workspace catalog project access is missing', async () => {
    state.getWorkspaceProjectAndRoleMock.mockResolvedValueOnce(null);

    const response = await request(app).get('/api/v1/projects/project-1/workspace-catalog');

    expect(response.status).toBe(404);
  });
});
