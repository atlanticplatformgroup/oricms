import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => {
  const changeRequests: Array<Record<string, unknown>> = [];
  const entries = new Map<string, Record<string, unknown>>([
    ['blog-posts:existing-post', {
      $id: 'existing-post',
      $type: 'blog-post',
      $status: 'draft',
      $createdAt: '2026-03-13T10:00:00.000Z',
      $updatedAt: '2026-03-13T10:00:00.000Z',
      title: 'Existing Post',
    }],
  ]);
  return {
    changeRequests,
    entries,
    tryAutoPublishChangeMock: vi.fn(),
    checkPermissionMock: vi.fn(),
    requirePermissionMock: vi.fn(),
    agentWriteConfigFindUniqueMock: vi.fn(),
    changeRequestFindFirstMock: vi.fn(),
    changeRequestCountMock: vi.fn(),
    changeRequestCreateMock: vi.fn(),
    changeRequestUpdateMock: vi.fn(),
    projectFindUniqueMock: vi.fn(),
    auditLogCreateMock: vi.fn(),
    saveCollectionsConfigMock: vi.fn(),
  };
});

const CONFIG_VERSION = 'a'.repeat(64);

function resetTestState() {
  state.changeRequests.length = 0;
  state.entries.clear();
  state.entries.set('blog-posts:existing-post', {
    $id: 'existing-post',
    $type: 'blog-post',
    $status: 'draft',
    $createdAt: '2026-03-13T10:00:00.000Z',
    $updatedAt: '2026-03-13T10:00:00.000Z',
    title: 'Existing Post',
  });
}

vi.mock('../middleware', () => ({
  authenticateAgentToken: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.projectId = 'project-1';
    req.userId = 'agent-user-1';
    req.projectRole = 'admin';
    req.agentTokenId = 'agent-token-1';
    req.user = {
      id: 'agent-user-1',
      email: 'agent@example.com',
      name: 'Codex',
      type: 'AGENT',
      avatarUrl: null,
      githubId: null,
      preferences: {
        theme: 'light',
        editorMode: 'split',
        notifications: { builds: true, invites: true, mentions: true },
        lastVisitedProjectId: null,
        projectDefaults: {},
      },
      createdAt: '2026-03-13T10:00:00.000Z',
      updatedAt: '2026-03-13T10:00:00.000Z',
    };
    req.agentGateway = {
      async getSessionBootstrap(branch?: string) {
        return {
          project: { id: 'project-1', name: 'Test Project', branch: branch ?? 'main', role: 'admin' },
          capabilities: {
            allowedBranches: ['main'],
            readableCollections: ['blog-posts'],
            writableCollections: ['blog-posts'],
            publishableCollections: ['blog-posts'],
          },
          contentModel: {
            collections: [{ id: 'blog-posts', label: 'Blog Posts', contentType: 'blog-post' }],
          },
          entryIdentity: {
            canonicalField: '$id',
            slugIsCanonicalId: false,
            useReturnedEntryIdAfterCreate: true,
          },
          workflow: {
            defaultEntryStatus: 'draft',
            readyStatusValue: 'published',
            readyStatusLabel: 'Ready',
            publishRequiresExplicitIntent: true,
            destructiveChangesRequireConfirmation: true,
          },
          writePolicies: [{
            collectionName: 'blog-posts',
            mode: 'AUTO_PUBLISH',
            targetBranch: 'main',
            canCreate: true,
            canUpdate: true,
            canDelete: true,
          }],
          summaryMarkdown: '# brief',
          generatedAt: '2026-03-13T12:00:00.000Z',
          configVersion: CONFIG_VERSION,
          configUpdatedAt: '2026-03-13T11:00:00.000Z',
        };
      },
      async getCollectionEntry(collectionName: string, entryId: string) {
        return state.entries.get(`${collectionName}:${entryId}`) ?? null;
      },
      getGitService() {
        return {
          async getCurrentCommit() {
            return { hash: 'commit-123' };
          },
        };
      },
    } as never;
    next();
  },
}));

vi.mock('../../permissions/middleware', () => ({
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  checkPermission: (...args: unknown[]) => state.checkPermissionMock(...args),
}));

vi.mock('../../collections/service', () => ({
  CollectionService: class MockCollectionService {
    async init() {}

    async listCollections() {
      return [{ id: 'blog-posts', label: 'Blog Posts', contentType: 'blog-post', path: 'content/blog-posts' }];
    }

    async getCollectionConfig(collectionName: string) {
      if (collectionName !== 'blog-posts') return null;
      return {
        id: 'blog-posts',
        label: 'Blog Posts',
        contentType: 'blog-post',
        path: 'content/blog-posts',
      };
    }

    async getContentType(contentType: string) {
      if (contentType !== 'blog-post') return null;
      return {
        $schema: 'content-type-v1',
        name: 'blog-post',
        plural: 'blog-posts',
        label: 'Blog Post',
        labelPlural: 'Blog Posts',
        fields: [{ key: 'title', type: 'string', label: 'Title', required: true }],
      };
    }
  },
}));

vi.mock('../../application/agent-publish/auto-publish-change', () => ({
  tryAutoPublishChange: (...args: unknown[]) => state.tryAutoPublishChangeMock(...args),
}));

vi.mock('../../application/collections/save-collections-config', () => ({
  saveCollectionsConfig: (...args: unknown[]) => state.saveCollectionsConfigMock(...args),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: (...args: unknown[]) => state.projectFindUniqueMock(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => state.auditLogCreateMock(...args),
    },
    agentChangeRequest: {
      count: (...args: unknown[]) => state.changeRequestCountMock(...args),
      create: (...args: unknown[]) => state.changeRequestCreateMock(...args),
      update: (...args: unknown[]) => state.changeRequestUpdateMock(...args),
    },
  },
}));

vi.mock('../../lib/api-services', () => ({
  apiServices: {
    prisma: {
      agentWriteConfig: {
        findUnique: (...args: unknown[]) => state.agentWriteConfigFindUniqueMock(...args),
      },
      agentChangeRequest: {
        findFirst: (...args: unknown[]) => state.changeRequestFindFirstMock(...args),
        update: (...args: unknown[]) => state.changeRequestUpdateMock(...args),
      },
    },
  },
}));

import router from '../write-routes';

const app = express();
app.use(express.json());
app.use('/api/v1/agent', router);

describe('agent write routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTestState();

    state.checkPermissionMock.mockResolvedValue(true);
    state.agentWriteConfigFindUniqueMock.mockResolvedValue({
      id: 'awc-1',
      projectId: 'project-1',
      collectionName: 'blog-posts',
      mode: 'AUTO_PUBLISH',
      targetBranch: 'main',
      autoMerge: false,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      allowedFields: [],
      blockedFields: [],
      maxWritesPerHour: 10,
      reviewerIds: [],
      requireValidation: true,
      maxFieldsPerChange: 5,
      createdAt: new Date('2026-03-13T10:00:00.000Z'),
      updatedAt: new Date('2026-03-13T11:00:00.000Z'),
    });
    state.changeRequestCountMock.mockResolvedValue(0);
    state.projectFindUniqueMock.mockResolvedValue({ id: 'project-1', repoUrl: 'https://example.com/repo.git', defaultBranch: 'main' });
    state.auditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
    state.saveCollectionsConfigMock.mockResolvedValue({
      createdCollections: [{ id: 'landing-pages', label: 'Landing Pages', contentType: 'landing-page', path: 'content/landing-pages' }],
    });
    state.changeRequestFindFirstMock.mockImplementation(async ({ where }: { where: { idempotencyKey?: string } }) => {
      return state.changeRequests.find((item) => item.projectId === 'project-1'
        && item.agentTokenId === 'agent-token-1'
        && item.action === where.action
        && item.idempotencyKey === where.idempotencyKey) ?? null;
    });
    state.changeRequestCreateMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const record = {
        id: `cr-${state.changeRequests.length + 1}`,
        status: 'PENDING',
        commitSha: null,
        ...data,
      };
      state.changeRequests.push(record);
      return { id: record.id, status: record.status, commitSha: record.commitSha };
    });
    state.changeRequestUpdateMock.mockImplementation(async ({ where, data }: { where: { id: string }, data: Record<string, unknown> }) => {
      const record = state.changeRequests.find((item) => item.id === where.id);
      if (!record) {
        throw new Error(`Unknown change request ${where.id}`);
      }
      Object.assign(record, data);
      return {
        id: String(record.id),
        status: String(record.status),
        commitSha: (record.commitSha as string | null | undefined) ?? null,
        payloadFingerprint: record.payloadFingerprint,
        resultData: record.resultData,
      };
    });
    state.tryAutoPublishChangeMock.mockImplementation(async (params: {
      action: 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSITION';
      entryId?: string;
      after: Record<string, unknown>;
      collectionName: string;
    }) => {
      if (params.action === 'CREATE') {
        const entry = {
          $id: 'new-post',
          $type: 'blog-post',
          $status: 'draft',
          $createdAt: '2026-03-13T12:00:00.000Z',
          $updatedAt: '2026-03-13T12:00:00.000Z',
          ...params.after,
        };
        state.entries.set(`${params.collectionName}:new-post`, entry);
        return {
          status: 'AUTO_PUBLISHED' as const,
          message: 'Entry created and auto-published',
          entryId: 'new-post',
          entry,
          commitSha: 'commit-123',
        };
      }
      if (params.action === 'DELETE') {
        state.entries.delete(`${params.collectionName}:${params.entryId}`);
        return {
          status: 'AUTO_PUBLISHED' as const,
          message: 'Entry deleted and auto-published',
          entryId: params.entryId,
          commitSha: 'commit-123',
        };
      }

      const nextEntry = {
        ...(state.entries.get(`${params.collectionName}:${params.entryId}`) ?? {}),
        ...params.after,
        $updatedAt: '2026-03-13T12:00:00.000Z',
      };
      state.entries.set(`${params.collectionName}:${params.entryId}`, nextEntry);
      return {
        status: 'AUTO_PUBLISHED' as const,
        message: params.action === 'TRANSITION' ? 'Entry status updated and auto-published' : 'Entry updated and auto-published',
        entryId: params.entryId,
        entry: nextEntry,
        commitSha: 'commit-123',
      };
    });
  });

  it('returns a generic preflight response for create', async () => {
    const response = await request(app)
      .post('/api/v1/agent/v1/preflight')
      .send({
        action: 'create',
        collectionName: 'blog-posts',
        data: { title: 'New post' },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      allowed: true,
      action: 'create',
      collectionName: 'blog-posts',
      branch: 'main',
      autoPublish: true,
      requiresConfirmation: false,
      configVersion: CONFIG_VERSION,
    });
  });

  it('requires a confirmation token for deletes', async () => {
    const preflight = await request(app)
      .post('/api/v1/agent/v1/preflight')
      .send({
        action: 'delete',
        collectionName: 'blog-posts',
        entryId: 'existing-post',
      });

    expect(preflight.body.data.requiresConfirmation).toBe(true);
    expect(preflight.body.data.confirmationToken).toBeTruthy();

    const denied = await request(app)
      .delete('/api/v1/agent/v1/collections/blog-posts/entries/existing-post');

    expect(denied.status).toBe(400);
    expect(denied.body.error.code).toBe('CONFIRMATION_REQUIRED');

    const confirmed = await request(app)
      .delete('/api/v1/agent/v1/collections/blog-posts/entries/existing-post')
      .set('x-agent-confirmation', preflight.body.data.confirmationToken);

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.deletedEntry).toMatchObject({
      entryId: 'existing-post',
      previousStatus: 'draft',
    });
  });

  it('replays create mutations with the same idempotency key', async () => {
    const first = await request(app)
      .post('/api/v1/agent/v1/collections/blog-posts/entries')
      .set('Idempotency-Key', 'idem-create-1')
      .send({ title: 'New post' });

    const second = await request(app)
      .post('/api/v1/agent/v1/collections/blog-posts/entries')
      .set('Idempotency-Key', 'idem-create-1')
      .send({ title: 'New post' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data).toEqual(first.body.data);
    expect(state.tryAutoPublishChangeMock).toHaveBeenCalledTimes(1);
  });

  it('returns canonical transition responses with persisted entry data', async () => {
    const response = await request(app)
      .post('/api/v1/agent/v1/collections/blog-posts/entries/existing-post/transition')
      .send({ targetStatus: 'published' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      action: 'transition',
      collectionName: 'blog-posts',
      entryId: 'existing-post',
      resultingStatus: 'published',
      configVersion: CONFIG_VERSION,
      persistence: {
        persisted: true,
        commitSha: 'commit-123',
      },
      entry: {
        $id: 'existing-post',
        $status: 'published',
      },
    });
  });


  it('preflights schema-definition creation as a structural mutation', async () => {
    const response = await request(app)
      .post('/api/v1/agent/v1/preflight')
      .send({
        action: 'createSchema',
        schemaName: 'landing-pages',
        data: {
          schema: {
            id: 'landing-pages',
            label: 'Landing Pages',
            contentType: 'landing-page',
            path: 'content/landing-pages',
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      allowed: true,
      action: 'createSchema',
      schemaName: 'landing-pages',
      branch: 'main',
      structural: true,
      autoPublish: true,
      requiresConfirmation: false,
    });
    expect(state.checkPermissionMock).toHaveBeenCalledWith('agent-user-1', 'project-1', 'schemas', 'update', 'admin');
  });

  it('creates schema definitions through the governed agent route and logs a structural audit event', async () => {
    const schema = {
      id: 'landing-pages',
      label: 'Landing Pages',
      contentType: 'landing-page',
      path: 'content/landing-pages',
    };

    const response = await request(app)
      .post('/api/v1/agent/v1/schemas')
      .set('Idempotency-Key', 'structural-create-1')
      .send({ schema });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      action: 'createSchema',
      schemaName: 'landing-pages',
      branch: 'main',
      structural: true,
      schema,
      createdSchemas: ['landing-pages'],
      persistence: { persisted: true, commitSha: 'commit-123' },
    });
    expect(state.saveCollectionsConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        branch: 'main',
        actor: expect.objectContaining({ id: 'agent-user-1', email: 'agent@example.com' }),
      }),
      expect.arrayContaining([
        expect.objectContaining({ id: 'blog-posts' }),
        schema,
      ]),
    );
    expect(state.auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        userId: 'agent-user-1',
        action: 'agent.schema.create',
        resourceType: 'schemaDefinition',
        resourceId: 'landing-pages',
      }),
    });
  });

  it('updates schema definitions through the governed agent route without creating default configs again', async () => {
    state.saveCollectionsConfigMock.mockResolvedValueOnce({ createdCollections: [] });
    const schema = {
      id: 'blog-posts',
      label: 'Editorial Posts',
      contentType: 'blog-post',
      path: 'content/blog-posts',
    };

    const response = await request(app)
      .put('/api/v1/agent/v1/schemas/blog-posts')
      .send({ schema });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      action: 'updateSchema',
      schemaName: 'blog-posts',
      branch: 'main',
      structural: true,
      schema,
      createdSchemas: [],
      persistence: { persisted: true, commitSha: 'commit-123' },
    });
    expect(state.saveCollectionsConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1', branch: 'main' }),
      expect.arrayContaining([schema]),
    );
    expect(state.auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'agent.schema.update',
        resourceType: 'schemaDefinition',
        resourceId: 'blog-posts',
        oldValue: expect.objectContaining({ id: 'blog-posts', label: 'Blog Posts' }),
        newValue: schema,
      }),
    });
  });

  it('does not expose agent-facing collection definition mutation routes', async () => {
    const response = await request(app)
      .post('/api/v1/agent/v1/collections')
      .send({ collection: { id: 'landing-pages' } });

    expect(response.status).toBe(404);
  });

  it('returns allowed false for invalid transitions during preflight', async () => {
    state.entries.set('blog-posts:published-post', {
      $id: 'published-post',
      $type: 'blog-post',
      $status: 'published',
      $createdAt: '2026-03-13T10:00:00.000Z',
      $updatedAt: '2026-03-13T10:00:00.000Z',
      title: 'Published Post',
    });

    const response = await request(app)
      .post('/api/v1/agent/v1/preflight')
      .send({
        action: 'transition',
        collectionName: 'blog-posts',
        entryId: 'published-post',
        targetStatus: 'published',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.allowed).toBe(false);
    expect(response.body.data.details.targetStatus[0]).toContain("already in 'published'");
  });
});
