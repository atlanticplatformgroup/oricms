import type { Prisma } from '@prisma/client';
import crypto from 'crypto';

export interface GraphQlPersistedQuery {
  id: string;
  query: string;
  sha256: string;
  operationName?: string;
  createdAt: string;
}

export interface GraphQlSchemaSnapshot {
  version: number;
  hash: string;
  sdl: string;
  createdAt: string;
}

export interface GraphQlProjectSettings {
  deliveryPersistedQueries: {
    enabled: boolean;
    requirePersistedOnly: boolean;
    queries: GraphQlPersistedQuery[];
  };
  schemaRegistry: {
    latestVersion: number;
    latestHash: string | null;
    snapshots: GraphQlSchemaSnapshot[];
  };
}

export function parseGraphQlSettings(input: unknown): GraphQlProjectSettings {
  const base: GraphQlProjectSettings = {
    deliveryPersistedQueries: { enabled: false, requirePersistedOnly: false, queries: [] },
    schemaRegistry: { latestVersion: 0, latestHash: null, snapshots: [] },
  };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return base;
  const settings = input as Record<string, unknown>;
  const graphQl = settings.graphql;
  if (!graphQl || typeof graphQl !== 'object' || Array.isArray(graphQl)) return base;
  const graphQlRecord = graphQl as Record<string, unknown>;

  const persisted = graphQlRecord.deliveryPersistedQueries;
  if (persisted && typeof persisted === 'object' && !Array.isArray(persisted)) {
    const persistedRecord = persisted as Record<string, unknown>;
    base.deliveryPersistedQueries.enabled = persistedRecord.enabled === true;
    base.deliveryPersistedQueries.requirePersistedOnly = persistedRecord.requirePersistedOnly === true;
    if (Array.isArray(persistedRecord.queries)) {
      base.deliveryPersistedQueries.queries = persistedRecord.queries
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .filter((item) => typeof item.id === 'string' && typeof item.query === 'string' && typeof item.sha256 === 'string')
        .map((item) => ({
          id: String(item.id),
          query: String(item.query),
          sha256: String(item.sha256),
          operationName: typeof item.operationName === 'string' ? item.operationName : undefined,
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        }));
    }
  }

  const registry = graphQlRecord.schemaRegistry;
  if (registry && typeof registry === 'object' && !Array.isArray(registry)) {
    const registryRecord = registry as Record<string, unknown>;
    base.schemaRegistry.latestVersion = typeof registryRecord.latestVersion === 'number' ? registryRecord.latestVersion : 0;
    base.schemaRegistry.latestHash = typeof registryRecord.latestHash === 'string' ? registryRecord.latestHash : null;
    if (Array.isArray(registryRecord.snapshots)) {
      base.schemaRegistry.snapshots = registryRecord.snapshots
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .filter((item) => typeof item.version === 'number' && typeof item.hash === 'string' && typeof item.sdl === 'string')
        .map((item) => ({
          version: Number(item.version),
          hash: String(item.hash),
          sdl: String(item.sdl),
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        }))
        .sort((a, b) => a.version - b.version);
    }
  }

  return base;
}

export function mergeGraphQlSettings(existingSettings: unknown, graphQlSettings: GraphQlProjectSettings): Prisma.InputJsonValue {
  const settings = (existingSettings && typeof existingSettings === 'object' && !Array.isArray(existingSettings))
    ? { ...(existingSettings as Record<string, unknown>) }
    : {};
  settings.graphql = graphQlSettings;
  return settings as Prisma.InputJsonValue;
}

export function buildSchemaSnapshot(sdl: string, previousVersion: number): GraphQlSchemaSnapshot {
  return {
    version: previousVersion + 1,
    hash: crypto.createHash('sha256').update(sdl).digest('hex'),
    sdl,
    createdAt: new Date().toISOString(),
  };
}

export function upsertSchemaSnapshot(
  graphQlSettings: GraphQlProjectSettings,
  snapshot: GraphQlSchemaSnapshot,
  limit = 30,
): { created: boolean; snapshot: GraphQlSchemaSnapshot } {
  const last = graphQlSettings.schemaRegistry.snapshots[graphQlSettings.schemaRegistry.snapshots.length - 1];
  if (last && last.hash === snapshot.hash) {
    graphQlSettings.schemaRegistry.latestHash = last.hash;
    graphQlSettings.schemaRegistry.latestVersion = last.version;
    return { created: false, snapshot: last };
  }
  graphQlSettings.schemaRegistry.snapshots.push(snapshot);
  if (graphQlSettings.schemaRegistry.snapshots.length > limit) {
    graphQlSettings.schemaRegistry.snapshots = graphQlSettings.schemaRegistry.snapshots.slice(-limit);
  }
  graphQlSettings.schemaRegistry.latestHash = snapshot.hash;
  graphQlSettings.schemaRegistry.latestVersion = snapshot.version;
  return { created: true, snapshot };
}
