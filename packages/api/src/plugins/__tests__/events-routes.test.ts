import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auditLogCountMock, auditLogCreateMock, auditLogFindManyMock, dispatchPluginHookMock, listWithDiagnosticsMock, projectFindUniqueMock, projectMemberFindUniqueMock, projectUpdateMock, setupPluginRouteDefaults } from './test-helpers';

setupPluginRouteDefaults();

describe('Plugin events routes', () => {
  it('lists plugin policy events', async () => {
    auditLogFindManyMock.mockResolvedValueOnce([{ id: 'pol-1', action: 'plugin.policy.ui.updated', createdAt: '2026-03-01T01:00:00.000Z', userId: 'user-1', newValue: { summary: { changed: ['allowlistedViews'] } } }]);
    const response = await request(app).get('/api/v1/projects/project-1/plugins/policy-events?limit=10');
    expect(response.status).toBe(200);
    expect(response.body.data.events[0].summary).toEqual({ changed: ['allowlistedViews'] });
  });

  it('rolls back plugin execution policy from policy event', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({ settings: { plugins: { executionPolicy: { mode: 'disabled', enforceManifestCapabilities: false, allowlistedHooks: ['collection.record.updated'], blockedPlugins: ['webhook-dispatcher'] } } } });
    auditLogFindManyMock.mockResolvedValueOnce([{ id: 'pol-rollback-1', action: 'plugin.policy.execution.updated', oldValue: { mode: 'webhook-only', enforceManifestCapabilities: true, allowlistedHooks: [], blockedPlugins: [] } }]).mockResolvedValueOnce([]);
    const response = await request(app).post('/api/v1/projects/project-1/plugins/policy-events/pol-rollback-1/rollback').send({});
    expect(response.status).toBe(200);
    expect(response.body.data.executionPolicy.mode).toBe('webhook-only');
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('previews plugin policy rollback before apply', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({ settings: { plugins: { executionPolicy: { mode: 'disabled', enforceManifestCapabilities: false, allowlistedHooks: ['collection.record.updated'], blockedPlugins: ['webhook-dispatcher'] } } } });
    auditLogFindManyMock.mockResolvedValueOnce([{ id: 'pol-preview-1', action: 'plugin.policy.execution.updated', oldValue: { mode: 'webhook-only', enforceManifestCapabilities: true, allowlistedHooks: [], blockedPlugins: [] } }]).mockResolvedValueOnce([]);
    const response = await request(app).post('/api/v1/projects/project-1/plugins/policy-events/pol-preview-1/rollback/preview').send({});
    expect(response.status).toBe(200);
    expect(response.body.data.rollbackExecutionPolicy.mode).toBe('webhook-only');
    expect(projectUpdateMock).not.toHaveBeenCalled();
  });

  it('prevents duplicate plugin policy rollback', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({ settings: { plugins: { executionPolicy: { mode: 'disabled', enforceManifestCapabilities: false, allowlistedHooks: ['collection.record.updated'], blockedPlugins: ['webhook-dispatcher'] } } } });
    auditLogFindManyMock.mockResolvedValueOnce([{ id: 'pol-rollback-dup', action: 'plugin.policy.execution.updated', oldValue: { mode: 'webhook-only', enforceManifestCapabilities: true, allowlistedHooks: [], blockedPlugins: [] } }]).mockResolvedValueOnce([{ id: 'already-rolled-back', action: 'plugin.policy.execution.rolled_back', newValue: { summary: { rollbackFromEventId: 'pol-rollback-dup' } } }]);
    const response = await request(app).post('/api/v1/projects/project-1/plugins/policy-events/pol-rollback-dup/rollback').send({});
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('POLICY_EVENT_ALREADY_ROLLED_BACK');
  });

  it('supports preview -> apply -> duplicate-guard rollback flow', async () => {
    projectFindUniqueMock.mockResolvedValue({ settings: { plugins: { executionPolicy: { mode: 'disabled', enforceManifestCapabilities: false, allowlistedHooks: ['collection.record.updated'], blockedPlugins: ['webhook-dispatcher'] } } } });
    auditLogFindManyMock
      .mockResolvedValueOnce([{ id: 'pol-flow-1', action: 'plugin.policy.execution.updated', oldValue: { mode: 'webhook-only', enforceManifestCapabilities: true, allowlistedHooks: [], blockedPlugins: [] } }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'pol-flow-1', action: 'plugin.policy.execution.updated', oldValue: { mode: 'webhook-only', enforceManifestCapabilities: true, allowlistedHooks: [], blockedPlugins: [] } }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'pol-flow-1', action: 'plugin.policy.execution.updated', oldValue: { mode: 'webhook-only', enforceManifestCapabilities: true, allowlistedHooks: [], blockedPlugins: [] } }])
      .mockResolvedValueOnce([{ id: 'already-rolled-back', action: 'plugin.policy.execution.rolled_back', newValue: { summary: { rollbackFromEventId: 'pol-flow-1' } } }]);

    const previewResponse = await request(app).post('/api/v1/projects/project-1/plugins/policy-events/pol-flow-1/rollback/preview').send({});
    expect(previewResponse.status).toBe(200);

    const applyResponse = await request(app).post('/api/v1/projects/project-1/plugins/policy-events/pol-flow-1/rollback').send({});
    expect(applyResponse.status).toBe(200);
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);

    const duplicateApplyResponse = await request(app).post('/api/v1/projects/project-1/plugins/policy-events/pol-flow-1/rollback').send({});
    expect(duplicateApplyResponse.status).toBe(409);
  });

  it('requires owner or admin for rollback operations', async () => {
    projectMemberFindUniqueMock.mockResolvedValueOnce({ role: 'editor' });
    const response = await request(app).post('/api/v1/projects/project-1/plugins/policy-events/pol-preview-1/rollback/preview').send({});
    expect(response.status).toBe(403);
  });

  it('lists plugin hook events with pagination', async () => {
    const response = await request(app).get('/api/v1/projects/project-1/plugins/events?page=1&limit=20&status=all');
    expect(response.status).toBe(200);
    expect(response.body.data.events).toHaveLength(2);
  });

  it('returns plugin hook event summary', async () => {
    auditLogCountMock.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    auditLogFindManyMock.mockResolvedValueOnce([{ id: 'evt-f1', newValue: { pluginId: 'seo-tools', event: 'page.workflow.transition', error: 'timeout' }, createdAt: '2026-03-01T00:30:00.000Z' }]);
    const response = await request(app).get('/api/v1/projects/project-1/plugins/events/summary');
    expect(response.status).toBe(200);
    expect(response.body.data.failedCount).toBe(2);
  });

  it('returns plugin health summary', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({ id: 'project-1', repoUrl: 'https://example.com/repo.git', defaultBranch: 'main', settings: { plugins: { enabled: ['seo-tools', 'ghost-plugin'], hookEndpoints: { 'seo-tools': { 'collection.record.created': 'https://hooks.example.com/created', 'collection.record.deleted': 'https://hooks.example.com/deleted' } }, executionPolicy: { blockedPlugins: ['seo-tools'] } } } });
    listWithDiagnosticsMock.mockResolvedValueOnce({ manifests: [{ id: 'seo-tools', name: 'SEO Tools', version: '1.0.0', sourcePath: 'plugins/seo-tools.yaml', hooks: ['collection.record.created'] }], invalidManifests: [{ sourcePath: 'plugins/bad.yaml', code: 'PLUGIN_MANIFEST_PARSE_ERROR', message: 'Manifest is not valid YAML' }] });
    const response = await request(app).get('/api/v1/projects/project-1/plugins/health');
    expect(response.status).toBe(200);
    expect(response.body.data.invalidManifestCount).toBe(1);
    expect(response.body.data.staleEnabledPlugins).toEqual(['ghost-plugin']);
  });

  it('previews plugin runtime reconciliation in dry-run mode', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({ id: 'project-1', repoUrl: 'https://example.com/repo.git', defaultBranch: 'main', settings: { plugins: { enabled: ['seo-tools', 'ghost-plugin'], hookEndpoints: { 'seo-tools': { 'collection.record.created': 'https://hooks.example.com/created', 'collection.record.deleted': 'https://hooks.example.com/deleted' }, 'ghost-plugin': { 'collection.record.updated': 'https://hooks.example.com/ghost' } }, retry: { maxAttempts: 3, baseDelayMs: 300, timeoutMs: 6000 } } } });
    listWithDiagnosticsMock.mockResolvedValueOnce({ manifests: [{ id: 'seo-tools', name: 'SEO Tools', version: '1.0.0', sourcePath: 'plugins/seo-tools.yaml', hooks: ['collection.record.created'] }], invalidManifests: [] });
    const response = await request(app).post('/api/v1/projects/project-1/plugins/reconcile').send({ dryRun: true });
    expect(response.status).toBe(200);
    expect(response.body.data.dryRun).toBe(true);
    expect(projectUpdateMock).not.toHaveBeenCalled();
  });

  it('applies plugin runtime reconciliation', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({ id: 'project-1', repoUrl: 'https://example.com/repo.git', defaultBranch: 'main', settings: { plugins: { enabled: ['seo-tools', 'ghost-plugin'], hookEndpoints: { 'seo-tools': { 'collection.record.created': 'https://hooks.example.com/created', 'collection.record.deleted': 'https://hooks.example.com/deleted' }, 'ghost-plugin': { 'collection.record.updated': 'https://hooks.example.com/ghost' } }, retry: { maxAttempts: 3, baseDelayMs: 300, timeoutMs: 6000 } } } });
    listWithDiagnosticsMock.mockResolvedValueOnce({ manifests: [{ id: 'seo-tools', name: 'SEO Tools', version: '1.0.0', sourcePath: 'plugins/seo-tools.yaml', hooks: ['collection.record.created'] }], invalidManifests: [] });
    const response = await request(app).post('/api/v1/projects/project-1/plugins/reconcile').send({ dryRun: false });
    expect(response.status).toBe(200);
    expect(response.body.data.applied).toBe(true);
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('fires plugin test event', async () => {
    const response = await request(app).post('/api/v1/projects/project-1/plugins/test-fire').send({ pluginId: 'seo-tools', event: 'collection.record.updated', payload: { sample: true } });
    expect(response.status).toBe(200);
    expect(response.body.data.result.sent).toBe(1);
    expect(dispatchPluginHookMock).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', event: 'collection.record.updated', resourceType: 'plugin', resourceId: 'seo-tools' }));
  });
});
