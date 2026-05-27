import { OriCmsClientError } from './errors';
import type {
  PluginExecutionPolicy,
  PluginHealthSummary,
  PluginHookEvent,
  PluginHooksConfig,
  PluginPolicyEvent,
  PluginPolicyRollbackPreview,
  PluginPolicyRollbackResult,
  PluginReconcileResult,
  PluginSecretMetadata,
  PluginUiContributionsSummary,
  PluginUiPolicy,
  PluginUiPolicyPreview,
} from './client-types';
import type { ClientTransport } from './transport';

interface PluginsClientContext {
  transport: ClientTransport;
}

const PLUGIN_AUTH_ERROR = 'Plugin management requires a management token';

export function createPluginsClient(context: PluginsClientContext) {
  async function requestPlugins<T>(
    path: string,
    options: {
      method?: string;
      jsonBody?: unknown;
      failureMessage: string;
    },
  ): Promise<T> {
    return context.transport.requestProjectJson<T>(`/plugins${path}`, {
      ...options,
      mode: 'management',
      requireManagementTokenMessage: PLUGIN_AUTH_ERROR,
    });
  }

  return {
    async list(): Promise<{ plugins: Array<Record<string, unknown>> }> {
      return requestPlugins('', {
        method: 'GET',
        failureMessage: 'Failed to list plugins',
      });
    },

    async get(pluginId: string): Promise<{ plugin: Record<string, unknown> }> {
      if (!pluginId.trim()) {
        throw new OriCmsClientError('Plugin id is required', 'VALIDATION_ERROR', 400);
      }

      return requestPlugins(`/id/${encodeURIComponent(pluginId)}`, {
        method: 'GET',
        failureMessage: 'Failed to fetch plugin',
      });
    },

    async setEnabled(enabled: string[]): Promise<{ enabled: string[] }> {
      return requestPlugins('/enabled', {
        method: 'PATCH',
        jsonBody: { enabled },
        failureMessage: 'Failed to update enabled plugins',
      });
    },

    async getHooksConfig(): Promise<PluginHooksConfig> {
      return requestPlugins('/hooks', {
        method: 'GET',
        failureMessage: 'Failed to fetch plugin hook config',
      });
    },

    async setHooksConfig(payload: {
      hookEndpoints?: Record<string, Record<string, string>>;
      retry?: { maxAttempts?: number; baseDelayMs?: number; timeoutMs?: number };
    }): Promise<PluginHooksConfig> {
      return requestPlugins('/hooks', {
        method: 'PATCH',
        jsonBody: payload,
        failureMessage: 'Failed to update plugin hook config',
      });
    },

    async listSecrets(): Promise<{ secrets: PluginSecretMetadata[] }> {
      return requestPlugins('/secrets', {
        method: 'GET',
        failureMessage: 'Failed to list plugin secrets',
      });
    },

    async rotateSecret(pluginId: string): Promise<{ pluginId: string; secret: string; secretPrefix: string; rotatedAt: string }> {
      if (!pluginId.trim()) {
        throw new OriCmsClientError('Plugin id is required', 'VALIDATION_ERROR', 400);
      }

      return requestPlugins(`/secrets/${encodeURIComponent(pluginId)}/rotate`, {
        method: 'POST',
        failureMessage: 'Failed to rotate plugin secret',
      });
    },

    async revokeSecret(pluginId: string): Promise<{ pluginId: string; revoked: boolean }> {
      if (!pluginId.trim()) {
        throw new OriCmsClientError('Plugin id is required', 'VALIDATION_ERROR', 400);
      }

      return requestPlugins(`/secrets/${encodeURIComponent(pluginId)}`, {
        method: 'DELETE',
        failureMessage: 'Failed to revoke plugin secret',
      });
    },

    async getExecutionPolicy(): Promise<PluginExecutionPolicy> {
      return requestPlugins('/execution-policy', {
        method: 'GET',
        failureMessage: 'Failed to fetch plugin execution policy',
      });
    },

    async setExecutionPolicy(payload: {
      mode?: 'disabled' | 'webhook-only';
      enforceManifestCapabilities?: boolean;
      allowlistedHooks?: string[];
      blockedPlugins?: string[];
    }): Promise<PluginExecutionPolicy> {
      return requestPlugins('/execution-policy', {
        method: 'PATCH',
        jsonBody: payload,
        failureMessage: 'Failed to update plugin execution policy',
      });
    },

    async fireTestEvent(payload: {
      pluginId: string;
      event: string;
      payload?: Record<string, unknown>;
    }): Promise<{
      pluginId: string;
      event: string;
      dispatched: number;
    }> {
      return requestPlugins('/test-fire', {
        method: 'POST',
        jsonBody: payload,
        failureMessage: 'Failed to fire plugin test event',
      });
    },

    async getHealth(): Promise<PluginHealthSummary> {
      return requestPlugins('/health', {
        method: 'GET',
        failureMessage: 'Failed to fetch plugin runtime health',
      });
    },

    async reconcile(payload?: {
      dryRun?: boolean;
    }): Promise<PluginReconcileResult> {
      return requestPlugins('/reconcile', {
        method: 'POST',
        jsonBody: payload || { dryRun: true },
        failureMessage: 'Failed to reconcile plugin runtime config',
      });
    },

    async getUiContributions(): Promise<PluginUiContributionsSummary> {
      return requestPlugins('/ui-contributions', {
        method: 'GET',
        failureMessage: 'Failed to fetch plugin UI contributions',
      });
    },

    async getUiPolicy(): Promise<PluginUiPolicy> {
      return requestPlugins('/ui-policy', {
        method: 'GET',
        failureMessage: 'Failed to fetch plugin UI policy',
      });
    },

    async setUiPolicy(payload: Partial<PluginUiPolicy>): Promise<PluginUiPolicy> {
      return requestPlugins('/ui-policy', {
        method: 'PATCH',
        jsonBody: payload,
        failureMessage: 'Failed to update plugin UI policy',
      });
    },

    async previewUiPolicy(payload: Partial<PluginUiPolicy>): Promise<PluginUiPolicyPreview> {
      return requestPlugins('/ui-policy/preview', {
        method: 'POST',
        jsonBody: payload,
        failureMessage: 'Failed to preview plugin UI policy impact',
      });
    },

    async listPolicyEvents(params?: {
      limit?: number;
    }): Promise<{ events: PluginPolicyEvent[] }> {
      const qs = new URLSearchParams();
      if (params?.limit) {
        qs.set('limit', String(params.limit));
      }

      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return requestPlugins(`/policy-events${suffix}`, {
        method: 'GET',
        failureMessage: 'Failed to fetch plugin policy events',
      });
    },

    async previewPolicyRollback(eventId: string): Promise<PluginPolicyRollbackPreview> {
      if (!eventId.trim()) {
        throw new OriCmsClientError('Policy event id is required', 'VALIDATION_ERROR', 400);
      }

      return requestPlugins(`/policy-events/${encodeURIComponent(eventId)}/rollback/preview`, {
        method: 'POST',
        jsonBody: {},
        failureMessage: 'Failed to preview policy rollback',
      });
    },

    async rollbackPolicyEvent(eventId: string): Promise<PluginPolicyRollbackResult> {
      if (!eventId.trim()) {
        throw new OriCmsClientError('Policy event id is required', 'VALIDATION_ERROR', 400);
      }

      return requestPlugins(`/policy-events/${encodeURIComponent(eventId)}/rollback`, {
        method: 'POST',
        jsonBody: {},
        failureMessage: 'Failed to rollback plugin policy event',
      });
    },

    async listEvents(params?: {
      page?: number;
      limit?: number;
      status?: 'all' | 'sent' | 'failed';
      pluginId?: string;
      event?: string;
    }): Promise<{
      events: PluginHookEvent[];
      pagination: {
        page: number;
        pageSize: number;
        pageCount: number;
        total: number;
      };
    }> {
      const qs = new URLSearchParams();
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.status) qs.set('status', params.status);
      if (params?.pluginId) qs.set('pluginId', params.pluginId);
      if (params?.event) qs.set('event', params.event);

      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return requestPlugins(`/events${suffix}`, {
        method: 'GET',
        failureMessage: 'Failed to fetch plugin hook events',
      });
    },

    async getEventSummary(): Promise<{
      sentCount: number;
      failedCount: number;
      successRate: number;
      latestFailures: Array<{
        id: string;
        createdAt: string;
        pluginId: string | null;
        event: string | null;
        error: string | null;
      }>;
    }> {
      return requestPlugins('/events/summary', {
        method: 'GET',
        failureMessage: 'Failed to fetch plugin hook summary',
      });
    },
  };
}
