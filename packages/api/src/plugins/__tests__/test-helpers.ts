import { beforeEach, vi } from 'vitest';
import express from 'express';

const mocks = vi.hoisted(() => ({
  projectFindUniqueMock: vi.fn(),
  projectMemberFindUniqueMock: vi.fn(),
  projectUpdateMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  auditLogCountMock: vi.fn(),
  auditLogFindManyMock: vi.fn(),
  dispatchPluginHookMock: vi.fn(),
  listMock: vi.fn(),
  listWithDiagnosticsMock: vi.fn(),
}));

export const projectFindUniqueMock = mocks.projectFindUniqueMock;
export const projectMemberFindUniqueMock = mocks.projectMemberFindUniqueMock;
export const projectUpdateMock = mocks.projectUpdateMock;
export const auditLogCreateMock = mocks.auditLogCreateMock;
export const auditLogCountMock = mocks.auditLogCountMock;
export const auditLogFindManyMock = mocks.auditLogFindManyMock;
export const dispatchPluginHookMock = mocks.dispatchPluginHookMock;
export const listMock = mocks.listMock;
export const listWithDiagnosticsMock = mocks.listWithDiagnosticsMock;

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requireOwnerOrAdmin: async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const projectId = req.params.projectId as string;
    const userId = (req.user?.id as string | undefined) || 'user-1';
    if (!projectId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }
    const membership = await mocks.projectMemberFindUniqueMock({ where: { userId_projectId: { userId, projectId } } });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Owner or admin access required' } });
      return;
    }
    next();
  },
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: mocks.projectFindUniqueMock,
      update: mocks.projectUpdateMock,
    },
    projectMember: {
      findUnique: mocks.projectMemberFindUniqueMock,
    },
    auditLog: {
      create: mocks.auditLogCreateMock,
      count: mocks.auditLogCountMock,
      findMany: mocks.auditLogFindManyMock,
    },
  },
}));

vi.mock('../service', () => ({
  PluginRegistryService: vi.fn().mockImplementation(() => ({
    list: mocks.listMock,
    listWithDiagnostics: mocks.listWithDiagnosticsMock,
  })),
}));

vi.mock('../hook-dispatcher', () => ({
  ALLOWED_PLUGIN_HOOKS: new Set([
    'page.workflow.transition',
    'collection.record.created',
    'collection.record.updated',
    'collection.record.deleted',
  ]),
  dispatchPluginHook: mocks.dispatchPluginHookMock,
}));

vi.mock('../../lib/crypto', () => ({
  encrypt: vi.fn((value: string) => `enc:${value}`),
  generateToken: vi.fn(() => 'test_generated_secret_token'),
}));

import router from '../routes';

export const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as express.Request & { user?: unknown }).user = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    type: 'HUMAN',
    avatarUrl: null,
    githubId: null,
    preferences: {
      theme: 'light',
      editorMode: 'split',
      notifications: {
        builds: true,
        invites: true,
        mentions: true,
      },
      lastVisitedProjectId: null,
      projectDefaults: {},
    },
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };
  next();
});
app.use('/api/v1/projects/:projectId/plugins', router);

export function setupPluginRouteDefaults() {
  beforeEach(() => {
    vi.clearAllMocks();
    projectFindUniqueMock.mockResolvedValue({
      id: 'project-1',
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
      settings: { plugins: { enabled: ['seo-tools'] } },
    });
    projectUpdateMock.mockResolvedValue({});
    projectMemberFindUniqueMock.mockResolvedValue({ role: 'owner' });
    auditLogCreateMock.mockResolvedValue({});
    auditLogCountMock.mockResolvedValue(2);
    auditLogFindManyMock.mockResolvedValue([
      {
        id: 'evt-1',
        action: 'plugin.hook.sent',
        resourceType: 'page',
        resourceId: 'content/pages/home.md',
        newValue: {
          pluginId: 'seo-tools',
          event: 'page.workflow.transition',
          endpoint: 'https://hooks.example.com/seo',
          attempts: 1,
        },
        createdAt: '2026-03-01T00:00:00.000Z',
        userId: 'user-1',
      },
      {
        id: 'evt-2',
        action: 'plugin.hook.failed',
        resourceType: 'collection',
        resourceId: 'post/1',
        newValue: {
          pluginId: 'seo-tools',
          event: 'collection.record.updated',
          error: 'Hook endpoint returned 500',
        },
        createdAt: '2026-03-01T00:10:00.000Z',
        userId: 'user-1',
      },
    ]);
    dispatchPluginHookMock.mockResolvedValue({ sent: 1, failed: 0, skipped: 0 });
    listMock.mockResolvedValue([
      { id: 'seo-tools', name: 'SEO Tools', version: '1.0.0', sourcePath: 'plugins/seo-tools.yaml' },
      { id: 'webhook-dispatcher', name: 'Webhook Dispatcher', version: '0.2.0', sourcePath: 'plugins/webhook-dispatcher.yaml' },
    ]);
    listWithDiagnosticsMock.mockResolvedValue({
      manifests: [
        {
          id: 'seo-tools',
          name: 'SEO Tools',
          version: '1.0.0',
          sourcePath: 'plugins/seo-tools.yaml',
          hooks: ['collection.record.created', 'collection.record.updated'],
          capabilities: { views: true, fieldTypes: true, webhooks: true },
          ui: { views: ['seo-audit-panel'], fieldTypes: ['seo-score'] },
        },
        {
          id: 'webhook-dispatcher',
          name: 'Webhook Dispatcher',
          version: '0.2.0',
          sourcePath: 'plugins/webhook-dispatcher.yaml',
          hooks: ['page.workflow.transition'],
          capabilities: { webhooks: true },
          ui: { views: ['webhook-debug'] },
        },
      ],
      invalidManifests: [],
    });
  });
}
