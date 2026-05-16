import type { CollectionEntry } from '@ori/shared';

export interface QueryOptions {
  filter?: Record<string, unknown>;
  sort?: Record<string, 'asc' | 'desc'>;
  page?: number;
  limit?: number;
  populate?: string | string[];
  search?: string;
}

export interface CollectionsListResponse {
  data: CollectionEntry[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface CreateClientOptions {
  apiUrl: string;
  projectId?: string;
  /** @deprecated Use projectId instead. */
  siteId?: string;
  token?: string;
  mode?: 'management' | 'delivery';
  headers?: Record<string, string>;
}

export interface ContentTypeSchemaFieldStub {
  key: string;
  type: string;
  label?: string;
}

export interface ContentTypeSchemaStub {
  id: string;
  name: string;
  label?: string;
  fields: ContentTypeSchemaFieldStub[];
}

export interface GraphQlExecuteOptions {
  variables?: Record<string, unknown>;
  operationName?: string;
}

export type GraphQlIntrospectionResult = Record<string, unknown>;

export interface GraphQlSchemaSnapshotMeta {
  version: number;
  hash: string;
  createdAt: string;
}

export interface GraphQlSchemaSnapshot extends GraphQlSchemaSnapshotMeta {
  sdl: string;
}

export interface PersistedQueryDefinitionInput {
  id: string;
  query: string;
  operationName?: string;
}

export interface VerifyPluginHookRequestInput {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
  resolveSecret: (secretPrefix: string | null) => string | null | Promise<string | null>;
  maxSkewSeconds?: number;
  nowMs?: number;
  hasSeenNonce?: (nonceKey: string) => boolean | Promise<boolean>;
  rememberNonce?: (nonceKey: string, ttlSeconds: number) => void | Promise<void>;
}

export interface VerifyPluginHookRequestResult {
  ok: boolean;
  code: string;
  message: string;
  status: number;
  metadata?: {
    hookId: string;
    timestamp: number;
    nonce: string;
    secretPrefix: string | null;
    replayKey: string;
  };
}

export interface VerifyRevalidationWebhookRequestInput {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
  secret: string;
  maxSkewSeconds?: number;
  nowMs?: number;
  allowLegacySecretHeader?: boolean;
}

export interface VerifyRevalidationWebhookRequestResult {
  ok: boolean;
  code: string;
  message: string;
  status: number;
  metadata?: {
    timestamp: number;
    replayWindowSeconds: number;
    authMode: 'signed' | 'legacy-secret-header';
  };
}

export interface PluginExecutionPolicy {
  mode: 'disabled' | 'webhook-only';
  enforceManifestCapabilities: boolean;
  allowlistedHooks: string[];
  blockedPlugins: string[];
}

export interface PluginHookRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  timeoutMs: number;
}

export interface PluginHooksConfig {
  hookEndpoints: Record<string, Record<string, string>>;
  retry: PluginHookRetryPolicy;
}

export interface PluginSecretMetadata {
  pluginId: string;
  secretPrefix: string;
  rotatedAt: string;
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

export interface PluginHealthSummary {
  invalidManifestCount: number;
  invalidManifests: Array<{
    sourcePath: string;
    code: string;
    message: string;
  }>;
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

export type PluginPolicyEventAction =
  | 'plugin.policy.execution.updated'
  | 'plugin.policy.ui.updated'
  | 'plugin.runtime.reconciled'
  | 'plugin.policy.execution.rolled_back'
  | 'plugin.policy.ui.rolled_back';

export interface PluginPolicyEvent {
  id: string;
  action: PluginPolicyEventAction;
  createdAt: string;
  userId: string | null;
  summary: unknown;
}

export interface PluginPolicyRollbackPreview {
  rollbackable: boolean;
  alreadyRolledBack: boolean;
  rolledBackAction: string;
  eventId: string;
  currentExecutionPolicy?: PluginExecutionPolicy;
  rollbackExecutionPolicy?: PluginExecutionPolicy;
  currentUiPolicy?: PluginUiPolicy;
  rollbackUiPolicy?: PluginUiPolicy;
}

export interface PluginPolicyRollbackResult {
  rolledBackAction: string;
  eventId: string;
  executionPolicy?: PluginExecutionPolicy;
  uiPolicy?: PluginUiPolicy;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
}
