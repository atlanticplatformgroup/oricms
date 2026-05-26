import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pluginApi } from '../plugins';
import * as core from '../core';

describe('pluginApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists plugins', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ plugins: [] });
    await pluginApi.list('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins');
  });

  it('sets enabled plugins', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ enabled: ['p1'] });
    const result = await pluginApi.setEnabled('p1', ['p1']);
    expect(result.enabled).toContain('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/enabled', {
      method: 'PATCH',
      body: { enabled: ['p1'] },
    });
  });

  it('gets hooks', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ hookEndpoints: {}, retry: { maxAttempts: 3, baseDelayMs: 1000, timeoutMs: 5000 } });
    await pluginApi.getHooks('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/hooks');
  });

  it('sets hooks', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ hookEndpoints: {}, retry: { maxAttempts: 3, baseDelayMs: 1000, timeoutMs: 5000 } });
    await pluginApi.setHooks('p1', { hookEndpoints: { plugin1: { event1: 'https://example.com' } } });
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/hooks', {
      method: 'PATCH',
      body: { hookEndpoints: { plugin1: { event1: 'https://example.com' } } },
    });
  });

  it('lists secrets', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ secrets: [] });
    await pluginApi.listSecrets('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/secrets');
  });

  it('rotates secret', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ pluginId: 'pl1', secret: 's', secretPrefix: 'sp', rotatedAt: '2024-01-01' });
    const result = await pluginApi.rotateSecret('p1', 'pl1');
    expect(result.pluginId).toBe('pl1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/secrets/pl1/rotate', { method: 'POST' });
  });

  it('revokes secret', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ pluginId: 'pl1', revoked: true });
    const result = await pluginApi.revokeSecret('p1', 'pl1');
    expect(result.revoked).toBe(true);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/secrets/pl1', { method: 'DELETE' });
  });

  it('gets execution policy', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ mode: 'webhook-only', enforceManifestCapabilities: true, allowlistedHooks: [], blockedPlugins: [] });
    await pluginApi.getExecutionPolicy('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/execution-policy');
  });

  it('sets execution policy', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ mode: 'disabled', enforceManifestCapabilities: false, allowlistedHooks: [], blockedPlugins: [] });
    const result = await pluginApi.setExecutionPolicy('p1', { mode: 'disabled' });
    expect(result.mode).toBe('disabled');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/execution-policy', {
      method: 'PATCH',
      body: { mode: 'disabled' },
    });
  });

  it('test fires', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ pluginId: 'pl1', event: 'e1', result: { sent: 1, failed: 0, skipped: 0 } });
    const result = await pluginApi.testFire('p1', { pluginId: 'pl1', event: 'e1' });
    expect(result.result.sent).toBe(1);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/test-fire', {
      method: 'POST',
      body: { pluginId: 'pl1', event: 'e1' },
    });
  });

  it('gets health', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ invalidManifestCount: 0, invalidManifests: [], staleEnabledPlugins: [], blockedEnabledPlugins: [], missingHookEndpoints: [], staleHookEndpoints: [] });
    await pluginApi.getHealth('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/health');
  });

  it('reconciles', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ dryRun: true, applied: false, changes: { removedEnabledPlugins: [], removedHookEndpoints: [] } });
    const result = await pluginApi.reconcile('p1', { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/reconcile', {
      method: 'POST',
      body: { dryRun: true },
    });
  });

  it('reconciles with default body', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ dryRun: false, applied: true, changes: { removedEnabledPlugins: [], removedHookEndpoints: [] } });
    await pluginApi.reconcile('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/reconcile', {
      method: 'POST',
      body: {},
    });
  });

  it('gets ui contributions', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ contributions: [], totals: { views: 0, fieldTypes: 0, rejectedViews: 0, rejectedFieldTypes: 0 } });
    await pluginApi.getUiContributions('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/ui-contributions');
  });

  it('gets ui policy', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ includeDisabledPlugins: false, allowlistedViews: [], allowlistedFieldTypes: [] });
    await pluginApi.getUiPolicy('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/ui-policy');
  });

  it('sets ui policy', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ includeDisabledPlugins: true, allowlistedViews: [], allowlistedFieldTypes: [] });
    const result = await pluginApi.setUiPolicy('p1', { includeDisabledPlugins: true });
    expect(result.includeDisabledPlugins).toBe(true);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/ui-policy', {
      method: 'PATCH',
      body: { includeDisabledPlugins: true },
    });
  });

  it('previews ui policy', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ currentPolicy: {} as any, previewPolicy: {} as any, current: {} as any, preview: {} as any });
    await pluginApi.previewUiPolicy('p1', { includeDisabledPlugins: true });
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/ui-policy/preview', {
      method: 'POST',
      body: { includeDisabledPlugins: true },
    });
  });

  it('lists policy events', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ events: [] });
    await pluginApi.listPolicyEvents('p1', { limit: 10 });
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/policy-events?limit=10');
  });

  it('lists policy events without params', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ events: [] });
    await pluginApi.listPolicyEvents('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/policy-events');
  });

  it('rolls back policy event', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ rolledBackAction: 'a', eventId: 'e1' });
    const result = await pluginApi.rollbackPolicyEvent('p1', 'e1');
    expect(result.eventId).toBe('e1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/policy-events/e1/rollback', {
      method: 'POST',
      body: {},
    });
  });

  it('previews rollback', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ rollbackable: true, alreadyRolledBack: false, rolledBackAction: 'a', eventId: 'e1' });
    const result = await pluginApi.previewRollbackPolicyEvent('p1', 'e1');
    expect(result.rollbackable).toBe(true);
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/policy-events/e1/rollback/preview', {
      method: 'POST',
      body: {},
    });
  });

  it('lists events with filters', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ events: [], pagination: { page: 1, pageSize: 20, pageCount: 1, total: 0 } });
    await pluginApi.listEvents('p1', { page: 1, limit: 20, status: 'failed', pluginId: 'pl1', event: 'e1' });
    const url = requestSpy.mock.calls[0][0] as string;
    expect(url).toContain('page=1');
    expect(url).toContain('limit=20');
    expect(url).toContain('status=failed');
    expect(url).toContain('pluginId=pl1');
    expect(url).toContain('event=e1');
  });

  it('gets event summary', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({ sentCount: 10, failedCount: 0, successRate: 100, latestFailures: [] });
    await pluginApi.getEventSummary('p1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/projects/p1/plugins/events/summary');
  });
});
