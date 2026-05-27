import { request } from './core';

export interface PluginManifestView {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  hooks?: string[];
  capabilities?: {
    fieldTypes?: boolean;
    views?: boolean;
    webhooks?: boolean;
    validators?: boolean;
    automations?: boolean;
  };
  enabled: boolean;
}

export interface PluginHookEvent {
  id: string;
  action: 'plugin.hook.sent' | 'plugin.hook.failed';
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
  userId: string | null;
  pluginId: string | null;
  event: string | null;
  endpoint: string | null;
  error: string | null;
  attempts: number | null;
  hookId: string | null;
  secretPrefix: string | null;
}

export interface PluginPolicyEvent {
  id: string;
  action:
    | 'plugin.policy.execution.updated'
    | 'plugin.policy.ui.updated'
    | 'plugin.runtime.reconciled'
    | 'plugin.policy.execution.rolled_back'
    | 'plugin.policy.ui.rolled_back';
  createdAt: string;
  userId: string | null;
  summary: unknown;
}

export interface PluginHealthSummary {
  invalidManifestCount: number;
  invalidManifests: Array<{ sourcePath: string; code: string; message: string }>;
  staleEnabledPlugins: string[];
  blockedEnabledPlugins: string[];
  missingHookEndpoints: Array<{ pluginId: string; hooks: string[] }>;
  staleHookEndpoints: Array<{ pluginId: string; hooks: string[] }>;
}

export interface PluginReconcileResult {
  dryRun: boolean;
  applied: boolean;
  changes: {
    removedEnabledPlugins: string[];
    removedHookEndpoints: Array<{ pluginId: string; hooks: string[] }>;
  };
}

export interface PluginUiContributionsSummary {
  contributions: Array<{
    pluginId: string;
    pluginName: string;
    enabled: boolean;
    views: string[];
    fieldTypes: string[];
    rejected: {
      views: string[];
      fieldTypes: string[];
    };
  }>;
  totals: {
    views: number;
    fieldTypes: number;
    rejectedViews: number;
    rejectedFieldTypes: number;
  };
}

export interface PluginUiPolicy {
  includeDisabledPlugins: boolean;
  allowlistedViews: string[];
  allowlistedFieldTypes: string[];
}

export interface PluginUiPolicyPreview {
  currentPolicy: PluginUiPolicy;
  previewPolicy: PluginUiPolicy;
  current: PluginUiContributionsSummary;
  preview: PluginUiContributionsSummary;
}

export const pluginApi = {
  async list(projectId: string): Promise<{ plugins: PluginManifestView[] }> {
    return request(`/api/v1/projects/${projectId}/plugins`);
  },
  async setEnabled(projectId: string, enabled: string[]): Promise<{ enabled: string[] }> {
    return request(`/api/v1/projects/${projectId}/plugins/enabled`, { method: 'PATCH', body: { enabled } });
  },
  async getHooks(projectId: string): Promise<{ hookEndpoints: Record<string, Record<string, string>>; retry: { maxAttempts: number; baseDelayMs: number; timeoutMs: number } }> {
    return request(`/api/v1/projects/${projectId}/plugins/hooks`);
  },
  async setHooks(projectId: string, data: { hookEndpoints?: Record<string, Record<string, string>>; retry?: { maxAttempts?: number; baseDelayMs?: number; timeoutMs?: number } }): Promise<{ hookEndpoints: Record<string, Record<string, string>>; retry: { maxAttempts: number; baseDelayMs: number; timeoutMs: number } }> {
    return request(`/api/v1/projects/${projectId}/plugins/hooks`, { method: 'PATCH', body: data });
  },
  async listSecrets(projectId: string): Promise<{ secrets: Array<{ pluginId: string; secretPrefix: string; rotatedAt: string }> }> {
    return request(`/api/v1/projects/${projectId}/plugins/secrets`);
  },
  async rotateSecret(projectId: string, pluginId: string): Promise<{ pluginId: string; secret: string; secretPrefix: string; rotatedAt: string }> {
    return request(`/api/v1/projects/${projectId}/plugins/secrets/${encodeURIComponent(pluginId)}/rotate`, { method: 'POST' });
  },
  async revokeSecret(projectId: string, pluginId: string): Promise<{ pluginId: string; revoked: boolean }> {
    return request(`/api/v1/projects/${projectId}/plugins/secrets/${encodeURIComponent(pluginId)}`, { method: 'DELETE' });
  },
  async getExecutionPolicy(projectId: string): Promise<{ mode: 'disabled' | 'webhook-only'; enforceManifestCapabilities: boolean; allowlistedHooks: string[]; blockedPlugins: string[] }> {
    return request(`/api/v1/projects/${projectId}/plugins/execution-policy`);
  },
  async setExecutionPolicy(projectId: string, data: { mode?: 'disabled' | 'webhook-only'; enforceManifestCapabilities?: boolean; allowlistedHooks?: string[]; blockedPlugins?: string[] }): Promise<{ mode: 'disabled' | 'webhook-only'; enforceManifestCapabilities: boolean; allowlistedHooks: string[]; blockedPlugins: string[] }> {
    return request(`/api/v1/projects/${projectId}/plugins/execution-policy`, { method: 'PATCH', body: data });
  },
  async testFire(projectId: string, data: { pluginId: string; event: string; payload?: Record<string, unknown> }): Promise<{ pluginId: string; event: string; result: { sent: number; failed: number; skipped: number } }> {
    return request(`/api/v1/projects/${projectId}/plugins/test-fire`, { method: 'POST', body: data });
  },
  async getHealth(projectId: string): Promise<PluginHealthSummary> {
    return request(`/api/v1/projects/${projectId}/plugins/health`);
  },
  async reconcile(projectId: string, data?: { dryRun?: boolean }): Promise<PluginReconcileResult> {
    return request(`/api/v1/projects/${projectId}/plugins/reconcile`, { method: 'POST', body: data || {} });
  },
  async getUiContributions(projectId: string): Promise<PluginUiContributionsSummary> {
    return request(`/api/v1/projects/${projectId}/plugins/ui-contributions`);
  },
  async getUiPolicy(projectId: string): Promise<PluginUiPolicy> {
    return request(`/api/v1/projects/${projectId}/plugins/ui-policy`);
  },
  async setUiPolicy(projectId: string, data: Partial<PluginUiPolicy>): Promise<PluginUiPolicy> {
    return request(`/api/v1/projects/${projectId}/plugins/ui-policy`, { method: 'PATCH', body: data });
  },
  async previewUiPolicy(projectId: string, data: Partial<PluginUiPolicy>): Promise<PluginUiPolicyPreview> {
    return request(`/api/v1/projects/${projectId}/plugins/ui-policy/preview`, { method: 'POST', body: data });
  },
  async listPolicyEvents(projectId: string, params?: { limit?: number }): Promise<{ events: PluginPolicyEvent[] }> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/api/v1/projects/${projectId}/plugins/policy-events${suffix}`);
  },
  async rollbackPolicyEvent(projectId: string, eventId: string): Promise<{ rolledBackAction: string; eventId: string; executionPolicy?: { mode: 'disabled' | 'webhook-only'; enforceManifestCapabilities: boolean; allowlistedHooks: string[]; blockedPlugins: string[] }; uiPolicy?: PluginUiPolicy }> {
    return request(`/api/v1/projects/${projectId}/plugins/policy-events/${encodeURIComponent(eventId)}/rollback`, { method: 'POST', body: {} });
  },
  async previewRollbackPolicyEvent(projectId: string, eventId: string): Promise<{ rollbackable: boolean; alreadyRolledBack: boolean; rolledBackAction: string; eventId: string; currentExecutionPolicy?: { mode: 'disabled' | 'webhook-only'; enforceManifestCapabilities: boolean; allowlistedHooks: string[]; blockedPlugins: string[] }; rollbackExecutionPolicy?: { mode: 'disabled' | 'webhook-only'; enforceManifestCapabilities: boolean; allowlistedHooks: string[]; blockedPlugins: string[] }; currentUiPolicy?: PluginUiPolicy; rollbackUiPolicy?: PluginUiPolicy }> {
    return request(`/api/v1/projects/${projectId}/plugins/policy-events/${encodeURIComponent(eventId)}/rollback/preview`, { method: 'POST', body: {} });
  },
  async listEvents(projectId: string, params?: { page?: number; limit?: number; status?: 'all' | 'sent' | 'failed'; pluginId?: string; event?: string }): Promise<{ events: PluginHookEvent[]; pagination: { page: number; pageSize: number; pageCount: number; total: number } }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    if (params?.pluginId) qs.set('pluginId', params.pluginId);
    if (params?.event) qs.set('event', params.event);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/api/v1/projects/${projectId}/plugins/events${suffix}`);
  },
  async getEventSummary(projectId: string): Promise<{ sentCount: number; failedCount: number; successRate: number; latestFailures: Array<{ id: string; createdAt: string; pluginId: string | null; event: string | null; error: string | null }> }> {
    return request(`/api/v1/projects/${projectId}/plugins/events/summary`);
  },
};
