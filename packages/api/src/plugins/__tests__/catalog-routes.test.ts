import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, listWithDiagnosticsMock, projectFindUniqueMock, projectUpdateMock, setupPluginRouteDefaults } from './test-helpers';

setupPluginRouteDefaults();

describe('Plugin catalog routes', () => {
  it('lists plugin manifests with enabled state', async () => {
    const response = await request(app).get('/api/v1/projects/project-1/plugins');
    expect(response.status).toBe(200);
    expect(response.body.data.plugins).toHaveLength(2);
    expect(response.body.data.plugins[0].id).toBe('seo-tools');
    expect(response.body.data.plugins[0].enabled).toBe(true);
    expect(response.body.data.plugins[1].enabled).toBe(false);
  });

  it('returns deterministic error when manifests are invalid', async () => {
    listWithDiagnosticsMock.mockResolvedValueOnce({
      manifests: [],
      invalidManifests: [{ sourcePath: 'plugins/bad.yaml', code: 'PLUGIN_MANIFEST_INVALID_SCHEMA', message: 'Manifest requires non-empty id, name, and version fields' }],
    });

    const response = await request(app).get('/api/v1/projects/project-1/plugins');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PLUGIN_MANIFEST_INVALID');
  });

  it('returns plugin by id', async () => {
    const response = await request(app).get('/api/v1/projects/project-1/plugins/id/seo-tools');
    expect(response.status).toBe(200);
    expect(response.body.data.plugin.id).toBe('seo-tools');
    expect(response.body.data.plugin.enabled).toBe(true);
  });

  it('returns ui contributions with capability filtering', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      id: 'project-1', repoUrl: 'https://example.com/repo.git', defaultBranch: 'main',
      settings: { plugins: { enabled: ['seo-tools'], uiPolicy: { includeDisabledPlugins: true } } },
    });
    const response = await request(app).get('/api/v1/projects/project-1/plugins/ui-contributions');
    expect(response.status).toBe(200);
    expect(response.body.data.totals.views).toBe(1);
    expect(response.body.data.totals.fieldTypes).toBe(1);
    expect(response.body.data.totals.rejectedViews).toBe(1);
  });

  it('returns plugin ui policy', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      settings: { plugins: { uiPolicy: { includeDisabledPlugins: true, allowlistedViews: ['seo-audit-panel'], allowlistedFieldTypes: ['seo-score'] } } },
    });
    const response = await request(app).get('/api/v1/projects/project-1/plugins/ui-policy');
    expect(response.status).toBe(200);
    expect(response.body.data.includeDisabledPlugins).toBe(true);
  });

  it('updates plugin ui policy', async () => {
    const response = await request(app).patch('/api/v1/projects/project-1/plugins/ui-policy').send({ includeDisabledPlugins: true, allowlistedViews: ['seo-audit-panel'], allowlistedFieldTypes: ['seo-score'] });
    expect(response.status).toBe(200);
    expect(projectUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('filters ui contributions by ui policy allowlist', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({
      id: 'project-1', repoUrl: 'https://example.com/repo.git', defaultBranch: 'main',
      settings: { plugins: { enabled: ['seo-tools'], uiPolicy: { includeDisabledPlugins: true, allowlistedViews: ['seo-audit-panel'], allowlistedFieldTypes: ['seo-score'] } } },
    });
    listWithDiagnosticsMock.mockResolvedValueOnce({ manifests: [{ id: 'seo-tools', name: 'SEO Tools', version: '1.0.0', sourcePath: 'plugins/seo-tools.yaml', hooks: ['collection.record.created'], capabilities: { views: true, fieldTypes: true, webhooks: true }, ui: { views: ['seo-audit-panel', 'seo-alerts'], fieldTypes: ['seo-score', 'seo-grade'] } }], invalidManifests: [] });
    const response = await request(app).get('/api/v1/projects/project-1/plugins/ui-contributions');
    expect(response.status).toBe(200);
    expect(response.body.data.totals.rejectedViews).toBe(1);
    expect(response.body.data.totals.rejectedFieldTypes).toBe(1);
  });

  it('previews ui policy impact without persisting', async () => {
    projectFindUniqueMock.mockResolvedValueOnce({ id: 'project-1', repoUrl: 'https://example.com/repo.git', defaultBranch: 'main', settings: { plugins: { enabled: ['seo-tools'], uiPolicy: { includeDisabledPlugins: false, allowlistedViews: ['seo-audit-panel', 'seo-alerts'], allowlistedFieldTypes: ['seo-score', 'seo-grade'] } } } });
    listWithDiagnosticsMock.mockResolvedValueOnce({ manifests: [{ id: 'seo-tools', name: 'SEO Tools', version: '1.0.0', sourcePath: 'plugins/seo-tools.yaml', hooks: ['collection.record.created'], capabilities: { views: true, fieldTypes: true, webhooks: true }, ui: { views: ['seo-audit-panel', 'seo-alerts'], fieldTypes: ['seo-score', 'seo-grade'] } }], invalidManifests: [] });
    const response = await request(app).post('/api/v1/projects/project-1/plugins/ui-policy/preview').send({ includeDisabledPlugins: true, allowlistedViews: ['seo-audit-panel'], allowlistedFieldTypes: ['seo-score'] });
    expect(response.status).toBe(200);
    expect(response.body.data.previewPolicy.includeDisabledPlugins).toBe(true);
    expect(projectUpdateMock).not.toHaveBeenCalled();
  });
});
