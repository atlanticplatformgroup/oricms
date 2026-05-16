import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchPluginHook } from '../hook-dispatcher';
import { verifyPluginHookRequest } from '../../../../client/src/index';

const {
  projectFindUniqueMock,
  auditLogCreateMock,
  listMock,
} = vi.hoisted(() => ({
  projectFindUniqueMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  listMock: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: projectFindUniqueMock,
    },
    auditLog: {
      create: auditLogCreateMock,
    },
  },
}));

vi.mock('../service', () => ({
  PluginRegistryService: vi.fn().mockImplementation(() => ({
    list: listMock,
  })),
}));

vi.mock('../../lib/crypto', () => ({
  decrypt: vi.fn(() => 'super_secret_key_value'),
}));

describe('plugin hook dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());

    projectFindUniqueMock.mockResolvedValue({
      id: 'project-1',
      name: 'Project One',
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
      settings: {
        plugins: {
          enabled: ['workflow-hook'],
          secrets: {
            'workflow-hook': {
              encryptedSecret: 'enc:workflow',
              secretPrefix: 'phs_demo1234',
              rotatedAt: '2026-03-01T00:00:00.000Z',
            },
          },
          hookEndpoints: {
            'workflow-hook': {
              'page.workflow.transition': 'https://hooks.example.com/workflow',
            },
          },
          retry: {
            maxAttempts: 2,
            baseDelayMs: 1,
            timeoutMs: 200,
          },
        },
      },
    });
    listMock.mockResolvedValue([
      {
        id: 'workflow-hook',
        name: 'Workflow Hook',
        version: '1.0.0',
        capabilities: {
          webhooks: true,
        },
        hooks: ['page.workflow.transition'],
      },
    ]);
    auditLogCreateMock.mockResolvedValue({});
  });

  it('dispatches allowed enabled plugin hook and audits success', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const result = await dispatchPluginHook({
      projectId: 'project-1',
      event: 'page.workflow.transition',
      resourceType: 'page',
      resourceId: 'content/pages/home.md',
      payload: { from: 'draft', to: 'published' },
      actor: { id: 'user-1', name: 'Test', email: 'test@example.com' },
    });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>)['X-OriCMS-Hook-Signature']).toContain('sha256=');
    expect((init?.headers as Record<string, string>)['X-OriCMS-Hook-Nonce']).toBeTypeOf('string');
    expect((init?.headers as Record<string, string>)['X-OriCMS-Hook-Timestamp']).toBeTypeOf('string');
    expect((init?.headers as Record<string, string>)['X-OriCMS-Hook-Secret-Prefix']).toBe('phs_demo1234');
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'plugin.hook.sent',
        }),
      })
    );
  });

  it('matches receiver verification contract with replay protection', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const seenKeys = new Set<string>();
    await dispatchPluginHook({
      projectId: 'project-1',
      event: 'page.workflow.transition',
      resourceType: 'page',
      resourceId: 'content/pages/home.md',
      payload: { from: 'draft', to: 'published' },
      actor: { id: 'user-1', name: 'Test', email: 'test@example.com' },
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    const rawBody = String(init?.body || '');

    const first = await verifyPluginHookRequest({
      headers,
      rawBody,
      resolveSecret: async (prefix) => (prefix === 'phs_demo1234' ? 'super_secret_key_value' : null),
      hasSeenNonce: (key) => seenKeys.has(key),
      rememberNonce: (key) => {
        seenKeys.add(key);
      },
    });

    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.metadata?.replayKey).toBeTypeOf('string');
    }

    const second = await verifyPluginHookRequest({
      headers,
      rawBody,
      resolveSecret: async (prefix) => (prefix === 'phs_demo1234' ? 'super_secret_key_value' : null),
      hasSeenNonce: (key) => seenKeys.has(key),
      rememberNonce: (key) => {
        seenKeys.add(key);
      },
    });
    expect(second.ok).toBe(false);
    expect(second.code).toBe('REPLAY_DETECTED');
  });

  it('does not dispatch disallowed hook', async () => {
    const fetchMock = vi.mocked(fetch);

    const result = await dispatchPluginHook({
      projectId: 'project-1',
      event: 'dangerous.execute',
      resourceType: 'page',
      payload: {},
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });

  it('retries and audits failure when endpoint keeps failing', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const result = await dispatchPluginHook({
      projectId: 'project-1',
      event: 'page.workflow.transition',
      resourceType: 'page',
      payload: {},
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'plugin.hook.failed',
        }),
      })
    );
  });

  it('does not dispatch when execution policy is disabled', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      id: 'project-1',
      name: 'Project One',
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
      settings: {
        plugins: {
          enabled: ['workflow-hook'],
          executionPolicy: {
            mode: 'disabled',
          },
        },
      },
    });

    const result = await dispatchPluginHook({
      projectId: 'project-1',
      event: 'page.workflow.transition',
      resourceType: 'page',
      payload: {},
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('enforces manifest webhooks capability when enabled', async () => {
    listMock.mockResolvedValueOnce([
      {
        id: 'workflow-hook',
        name: 'Workflow Hook',
        version: '1.0.0',
        hooks: ['page.workflow.transition'],
        capabilities: {
          webhooks: false,
        },
      },
    ]);

    const result = await dispatchPluginHook({
      projectId: 'project-1',
      event: 'page.workflow.transition',
      resourceType: 'page',
      payload: {},
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
