import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  auditLogCreateMock,
  auditLogFindManyMock,
  projectFindUniqueMock,
  projectUpdateMock,
  setupPluginRouteDefaults,
} from './test-helpers';

setupPluginRouteDefaults();

describe('Plugin config routes', () => {
  it('patches enabled plugin ids', async () => {
    const response = await request(app).patch('/api/v1/projects/project-1/plugins/enabled').send({ enabled: ['webhook-dispatcher'] });
    expect(response.status).toBe(200);
    expect(response.body.data.enabled).toEqual(['webhook-dispatcher']);
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown plugin ids when patching enabled set', async () => {
    const response = await request(app).patch('/api/v1/projects/project-1/plugins/enabled').send({ enabled: ['unknown-plugin'] });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('PLUGIN_NOT_FOUND');
  });

  it('returns plugin hook config', async () => {
    const response = await request(app).get('/api/v1/projects/project-1/plugins/hooks');
    expect(response.status).toBe(200);
    expect(response.body.data.retry.maxAttempts).toBeDefined();
  });

  it('updates plugin hook config', async () => {
    const response = await request(app).patch('/api/v1/projects/project-1/plugins/hooks').send({ hookEndpoints: { 'seo-tools': { 'collection.record.created': 'https://hooks.example.com/seo-created' } }, retry: { maxAttempts: 4, baseDelayMs: 250, timeoutMs: 4000 } });
    expect(response.status).toBe(200);
    expect(response.body.data.retry.maxAttempts).toBe(4);
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('rejects hook config updates for hooks not declared by plugin manifest', async () => {
    const response = await request(app).patch('/api/v1/projects/project-1/plugins/hooks').send({ hookEndpoints: { 'seo-tools': { 'collection.record.deleted': 'https://hooks.example.com/seo-deleted' } } });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('PLUGIN_HOOK_NOT_DECLARED');
  });

  it('lists plugin secret metadata only', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({ settings: { plugins: { secrets: { 'seo-tools': { encryptedSecret: 'enc:value', secretPrefix: 'phs_abcd1234', rotatedAt: '2026-03-01T00:00:00.000Z' } } } } });
    const response = await request(app).get('/api/v1/projects/project-1/plugins/secrets');
    expect(response.status).toBe(200);
    expect(response.body.data.secrets[0].secretPrefix).toBe('phs_abcd1234');
    expect(JSON.stringify(response.body)).not.toContain('encryptedSecret');
  });

  it('rotates plugin secret and returns plaintext once', async () => {
    const response = await request(app).post('/api/v1/projects/project-1/plugins/secrets/seo-tools/rotate');
    expect(response.status).toBe(201);
    expect(response.body.data.secret).toContain('phs_');
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('revokes plugin secret', async () => {
    const response = await request(app).delete('/api/v1/projects/project-1/plugins/secrets/seo-tools');
    expect(response.status).toBe(200);
    expect(response.body.data.revoked).toBe(true);
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('gets plugin execution policy', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({ settings: { plugins: { executionPolicy: { mode: 'disabled', enforceManifestCapabilities: true, allowlistedHooks: ['page.workflow.transition'], blockedPlugins: ['legacy-plugin'] } } } });
    const response = await request(app).get('/api/v1/projects/project-1/plugins/execution-policy');
    expect(response.status).toBe(200);
    expect(response.body.data.mode).toBe('disabled');
  });

  it('updates plugin execution policy', async () => {
    const response = await request(app).patch('/api/v1/projects/project-1/plugins/execution-policy').send({ mode: 'disabled', enforceManifestCapabilities: false, allowlistedHooks: ['collection.record.updated'], blockedPlugins: ['webhook-dispatcher'] });
    expect(response.status).toBe(200);
    expect(response.body.data.enforceManifestCapabilities).toBe(false);
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  it('reconciles stale enabled plugins and hook endpoints when dry run is disabled', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      id: 'project-1',
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
      settings: {
        plugins: {
          enabled: ['seo-tools', 'removed-plugin'],
          hookEndpoints: {
            'seo-tools': {
              'collection.record.created': 'https://hooks.example.com/create',
              'collection.record.deleted': 'https://hooks.example.com/delete',
            },
            'removed-plugin': {
              'collection.record.updated': 'https://hooks.example.com/removed',
            },
          },
          retry: { maxAttempts: 3, baseDelayMs: 100, timeoutMs: 1000 },
        },
      },
    });

    const response = await request(app)
      .post('/api/v1/projects/project-1/plugins/reconcile')
      .send({ dryRun: false });

    expect(response.status).toBe(200);
    expect(response.body.data.applied).toBe(true);
    expect(response.body.data.changes.removedEnabledPlugins).toEqual(['removed-plugin']);
    expect(response.body.data.changes.removedHookEndpoints).toEqual([
      { pluginId: 'seo-tools', hooks: ['collection.record.deleted'] },
      { pluginId: 'removed-plugin', hooks: ['collection.record.updated'] },
    ]);
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  it('previews UI policy contributions with allowlist filtering', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      id: 'project-1',
      repoUrl: 'https://example.com/repo.git',
      defaultBranch: 'main',
      settings: {
        plugins: {
          enabled: ['seo-tools', 'webhook-dispatcher'],
          uiPolicy: {
            includeDisabledPlugins: false,
            allowlistedViews: ['seo-audit-panel', 'webhook-debug'],
            allowlistedFieldTypes: ['seo-score'],
          },
        },
      },
    });

    const response = await request(app)
      .post('/api/v1/projects/project-1/plugins/ui-policy/preview')
      .send({ allowlistedViews: ['seo-audit-panel'] });

    expect(response.status).toBe(200);
    expect(response.body.data.currentPolicy.allowlistedViews).toEqual(['seo-audit-panel', 'webhook-debug']);
    expect(response.body.data.previewPolicy.allowlistedViews).toEqual(['seo-audit-panel']);
    expect(response.body.data.preview.contributions[0].views).toEqual(['seo-audit-panel']);
  });

  it('previews rollback for execution policy events', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      settings: {
        plugins: {
          executionPolicy: {
            mode: 'disabled',
            enforceManifestCapabilities: false,
            allowlistedHooks: ['collection.record.updated'],
            blockedPlugins: ['webhook-dispatcher'],
          },
        },
      },
    });
    auditLogFindManyMock
      .mockResolvedValueOnce([
        {
          id: 'evt-exec',
          action: 'plugin.policy.execution.updated',
          oldValue: {
            mode: 'webhook-only',
            enforceManifestCapabilities: true,
            allowlistedHooks: [],
            blockedPlugins: [],
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await request(app)
      .post('/api/v1/projects/project-1/plugins/policy-events/evt-exec/rollback/preview');

    expect(response.status).toBe(200);
    expect(response.body.data.rollbackable).toBe(true);
    expect(response.body.data.rollbackExecutionPolicy.mode).toBe('webhook-only');
    expect(response.body.data.currentExecutionPolicy.mode).toBe('disabled');
  });

  it('rolls back UI policy events and records an audit entry', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      settings: {
        plugins: {
          uiPolicy: {
            includeDisabledPlugins: true,
            allowlistedViews: ['seo-audit-panel'],
            allowlistedFieldTypes: ['seo-score'],
          },
        },
      },
    });
    auditLogFindManyMock
      .mockResolvedValueOnce([
        {
          id: 'evt-ui',
          action: 'plugin.policy.ui.updated',
          oldValue: {
            includeDisabledPlugins: false,
            allowlistedViews: ['webhook-debug'],
            allowlistedFieldTypes: [],
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await request(app)
      .post('/api/v1/projects/project-1/plugins/policy-events/evt-ui/rollback');

    expect(response.status).toBe(200);
    expect(response.body.data.uiPolicy).toEqual({
      includeDisabledPlugins: false,
      allowlistedViews: ['webhook-debug'],
      allowlistedFieldTypes: [],
    });
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  it('rejects rollback when a policy event was already rolled back', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      settings: {
        plugins: {
          executionPolicy: {
            mode: 'disabled',
            enforceManifestCapabilities: false,
            allowlistedHooks: [],
            blockedPlugins: [],
          },
        },
      },
    });
    auditLogFindManyMock
      .mockResolvedValueOnce([
        {
          id: 'evt-exec',
          action: 'plugin.policy.execution.updated',
          oldValue: {
            mode: 'webhook-only',
            enforceManifestCapabilities: true,
            allowlistedHooks: [],
            blockedPlugins: [],
          },
        },
      ])
      .mockResolvedValueOnce([{ id: 'evt-rollback' }]);

    const response = await request(app)
      .post('/api/v1/projects/project-1/plugins/policy-events/evt-exec/rollback');

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('POLICY_EVENT_ALREADY_ROLLED_BACK');
    expect(projectUpdateMock).not.toHaveBeenCalled();
  });
});
