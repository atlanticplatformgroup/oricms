import type {
  CollectionEntry,
} from '@ori/shared';
import { OriCmsClientError } from './errors.js';
import { createGraphqlClient } from './graphql-client.js';
import { createPluginsClient } from './plugins-client.js';
import { createResourcesClient } from './resources-client.js';
import { createSchemasClient } from './schemas-client.js';
import { createClientTransport } from './transport.js';
import { createWorkspaceClient } from './workspace-client.js';
import {
  verifyPluginHookRequest,
  verifyRevalidationWebhookRequest,
} from './webhook-verification.js';
import type {
  ApiEnvelope,
  CollectionsListResponse,
  CreateClientOptions,
  QueryOptions,
} from './client-types.js';

export type {
  CollectionsListResponse,
  ContentTypeSchemaFieldStub,
  ContentTypeSchemaStub,
  CreateClientOptions,
  GraphQlExecuteOptions,
  GraphQlIntrospectionResult,
  GraphQlSchemaSnapshot,
  GraphQlSchemaSnapshotMeta,
  PersistedQueryDefinitionInput,
  PluginExecutionPolicy,
  PluginHealthSummary,
  PluginHookEvent,
  PluginHookRetryPolicy,
  PluginHooksConfig,
  PluginPolicyEvent,
  PluginPolicyEventAction,
  PluginPolicyRollbackPreview,
  PluginPolicyRollbackResult,
  PluginReconcileResult,
  PluginSecretMetadata,
  PluginUiContributionsSummary,
  PluginUiPolicy,
  PluginUiPolicyPreview,
  QueryOptions,
  VerifyPluginHookRequestInput,
  VerifyPluginHookRequestResult,
  VerifyRevalidationWebhookRequestInput,
  VerifyRevalidationWebhookRequestResult,
} from './client-types.js';
export { OriCmsClientError } from './errors.js';
export { generateSchemaTypeStubs } from './schemas-client.js';
export { verifyPluginHookRequest, verifyRevalidationWebhookRequest } from './webhook-verification.js';

interface ResolvedProjectIdentity {
  projectId: string;
}

function resolveProjectIdentity(options: CreateClientOptions): ResolvedProjectIdentity {
  const projectId = options.projectId ?? options.siteId;
  if (!projectId) {
    throw new OriCmsClientError('projectId is required', 'VALIDATION_ERROR', 400);
  }

  return { projectId };
}

function attachLegacySiteIdAlias<T extends { projectId: string }>(client: T): T & { readonly siteId: string } {
  // Keep the deprecated alias available for older callers without making it the primary client contract.
  return Object.defineProperty(client, 'siteId', {
    enumerable: true,
    get() {
      return client.projectId;
    },
  }) as T & { readonly siteId: string };
}

function toQueryString(query?: QueryOptions): string {
  if (!query) return '';

  const params = new URLSearchParams();

  if (query.filter && Object.keys(query.filter).length > 0) {
    params.set('filter', JSON.stringify(query.filter));
  }
  if (query.sort && Object.keys(query.sort).length > 0) {
    params.set('sort', JSON.stringify(query.sort));
  }
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.populate) {
    params.set('populate', Array.isArray(query.populate) ? query.populate.join(',') : query.populate);
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export function createClient(options: CreateClientOptions) {
  const normalizedApiUrl = options.apiUrl.replace(/\/+$/, '');
  const mode = options.mode || (options.token ? 'management' : 'delivery');
  const { projectId } = resolveProjectIdentity(options);
  const projectBasePath = mode === 'management'
    ? `/api/v1/projects/${projectId}`
    : `/api/v1/delivery/projects/${projectId}`;
  const collectionsBasePath = `${projectBasePath}/collections`;
  const transport = createClientTransport({
    normalizedApiUrl,
    projectId,
    mode,
    token: options.token,
    headers: options.headers,
  });

  async function requestFromBase<T>(basePath: string, path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (options.token && mode === 'management') {
      headers.Authorization = `Bearer ${options.token}`;
    }

    const response = await fetch(`${normalizedApiUrl}${basePath}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers || {}),
      },
    });

    const json = await response.json() as ApiEnvelope<T>;
    if (!response.ok || !json.success || json.data === undefined) {
      throw new OriCmsClientError(
        json.error?.message || 'Request failed',
        json.error?.code || 'REQUEST_FAILED',
        response.status,
      );
    }

    return json.data;
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    return requestFromBase(collectionsBasePath, path, init);
  }

  const collections = {
    async list(type: string, query?: QueryOptions): Promise<CollectionsListResponse> {
      return request<CollectionsListResponse>(`/${encodeURIComponent(type)}${toQueryString(query)}`);
    },

    async get(type: string, id: string, query?: Pick<QueryOptions, 'populate'>): Promise<{ record: CollectionEntry }> {
      const qs = toQueryString(query);
      return request<{ record: CollectionEntry }>(`/${encodeURIComponent(type)}/${encodeURIComponent(id)}${qs}`);
    },

    async create(type: string, data: Record<string, unknown>): Promise<{ record: CollectionEntry }> {
      if (mode !== 'management') {
        throw new OriCmsClientError('Create is only available in management mode', 'INVALID_MODE', 400);
      }
      return request<{ record: CollectionEntry }>(`/${encodeURIComponent(type)}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(type: string, id: string, data: Record<string, unknown>): Promise<{ record: CollectionEntry }> {
      if (mode !== 'management') {
        throw new OriCmsClientError('Update is only available in management mode', 'INVALID_MODE', 400);
      }
      return request<{ record: CollectionEntry }>(`/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async delete(type: string, id: string): Promise<void> {
      if (mode !== 'management') {
        throw new OriCmsClientError('Delete is only available in management mode', 'INVALID_MODE', 400);
      }
      await request<{ message?: string }>(`/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  };

  const schemas = createSchemasClient({
    normalizedApiUrl,
    projectId,
    token: options.token,
    headers: options.headers,
  });

  const resources = createResourcesClient({
    mode,
    projectBasePath,
    requestFromBase,
  });

  const workspace = createWorkspaceClient({
    mode,
    projectBasePath,
    requestFromBase,
  });

  const graphql = createGraphqlClient({
    mode,
    transport,
  });

  const plugins = createPluginsClient({
    transport,
  });

  const client = {
    mode,
    projectId,
    collections,
    resources,
    workspace,
    schemas,
    graphql,
    plugins,
  };

  return attachLegacySiteIdAlias(client);
}
