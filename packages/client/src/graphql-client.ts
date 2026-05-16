import { OriCmsClientError } from './errors.js';
import type {
  GraphQlExecuteOptions,
  GraphQlIntrospectionResult,
  GraphQlSchemaSnapshot,
  GraphQlSchemaSnapshotMeta,
  PersistedQueryDefinitionInput,
} from './client-types.js';
import type { ClientTransport } from './transport.js';

interface GraphqlClientContext {
  mode: 'management' | 'delivery';
  transport: ClientTransport;
}

const PERSISTED_QUERY_AUTH_ERROR = 'Persisted query management requires a management token';
const SCHEMA_REGISTRY_AUTH_ERROR = 'Schema registry access requires a management token';

export function createGraphqlClient(context: GraphqlClientContext) {
  return {
    async execute<T = unknown>(query: string, execOptions?: GraphQlExecuteOptions): Promise<T> {
      if (!query.trim()) {
        throw new OriCmsClientError('GraphQL query is required', 'VALIDATION_ERROR', 400);
      }

      return context.transport.requestProjectJson<T>('/graphql', {
        method: 'POST',
        jsonBody: {
          query,
          ...(execOptions?.variables ? { variables: execOptions.variables } : {}),
          ...(execOptions?.operationName ? { operationName: execOptions.operationName } : {}),
        },
        failureMessage: 'GraphQL request failed',
        requireManagementTokenMessage: context.mode === 'management'
          ? 'GraphQL endpoint requires a management token'
          : undefined,
      });
    },

    async getSchemaSdl(): Promise<string> {
      return context.transport.requestProjectText('/graphql/schema', {
        method: 'GET',
        failureMessage: 'Failed to fetch GraphQL schema SDL',
        requireManagementTokenMessage: context.mode === 'management'
          ? 'Schema SDL endpoint requires a management token'
          : undefined,
      });
    },

    async getSchemaIntrospection<T = GraphQlIntrospectionResult>(): Promise<T> {
      return context.transport.requestProjectJson<T>('/graphql/schema/introspection', {
        method: 'GET',
        failureMessage: 'Failed to fetch GraphQL introspection schema',
        requireManagementTokenMessage: context.mode === 'management'
          ? 'Schema introspection endpoint requires a management token'
          : undefined,
      });
    },

    async executePersisted<T = unknown>(
      persistedQueryId: string,
      execOptions?: Omit<GraphQlExecuteOptions, 'operationName'> & { operationName?: string },
    ): Promise<T> {
      if (context.mode !== 'delivery') {
        throw new OriCmsClientError('Persisted query execution is only available in delivery mode', 'INVALID_MODE', 400);
      }
      if (!persistedQueryId.trim()) {
        throw new OriCmsClientError('Persisted query id is required', 'VALIDATION_ERROR', 400);
      }

      return context.transport.requestProjectJson<T>('/graphql', {
        method: 'POST',
        mode: 'delivery',
        jsonBody: {
          persistedQueryId,
          ...(execOptions?.variables ? { variables: execOptions.variables } : {}),
          ...(execOptions?.operationName ? { operationName: execOptions.operationName } : {}),
        },
        failureMessage: 'GraphQL persisted query request failed',
      });
    },

    async listPersistedQueries(): Promise<{
      enabled: boolean;
      requirePersistedOnly: boolean;
      queries: Array<{ id: string; sha256: string; operationName: string | null; createdAt: string }>;
    }> {
      return context.transport.requestProjectJson('/graphql/persisted-queries', {
        method: 'GET',
        mode: 'management',
        failureMessage: 'Failed to list persisted queries',
        requireManagementTokenMessage: PERSISTED_QUERY_AUTH_ERROR,
      });
    },

    async upsertPersistedQueries(payload: {
      enabled?: boolean;
      requirePersistedOnly?: boolean;
      queries: PersistedQueryDefinitionInput[];
    }): Promise<{
      enabled: boolean;
      requirePersistedOnly: boolean;
      queries: Array<{ id: string; sha256: string; operationName: string | null; createdAt: string }>;
    }> {
      return context.transport.requestProjectJson('/graphql/persisted-queries', {
        method: 'PUT',
        mode: 'management',
        jsonBody: payload,
        failureMessage: 'Failed to update persisted queries',
        requireManagementTokenMessage: PERSISTED_QUERY_AUTH_ERROR,
      });
    },

    async listSchemaSnapshots(): Promise<{
      latestVersion: number;
      latestHash: string | null;
      snapshots: GraphQlSchemaSnapshotMeta[];
    }> {
      return context.transport.requestProjectJson('/graphql/schema/snapshots', {
        method: 'GET',
        mode: 'management',
        failureMessage: 'Failed to list schema snapshots',
        requireManagementTokenMessage: SCHEMA_REGISTRY_AUTH_ERROR,
      });
    },

    async captureSchemaSnapshot(): Promise<{ created: boolean; snapshot: GraphQlSchemaSnapshot }> {
      return context.transport.requestProjectJson('/graphql/schema/snapshots', {
        method: 'POST',
        mode: 'management',
        failureMessage: 'Failed to capture schema snapshot',
        requireManagementTokenMessage: SCHEMA_REGISTRY_AUTH_ERROR,
      });
    },

    async getSchemaSnapshot(version: number): Promise<GraphQlSchemaSnapshot> {
      if (!Number.isInteger(version) || version <= 0) {
        throw new OriCmsClientError('Snapshot version must be a positive integer', 'VALIDATION_ERROR', 400);
      }

      return context.transport.requestProjectJson(`/graphql/schema/snapshots/${version}`, {
        method: 'GET',
        mode: 'management',
        failureMessage: 'Failed to fetch schema snapshot',
        requireManagementTokenMessage: SCHEMA_REGISTRY_AUTH_ERROR,
      });
    },
  };
}
