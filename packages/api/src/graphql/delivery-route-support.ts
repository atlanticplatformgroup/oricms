import crypto from 'crypto';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { DeliveryProjectionService } from '../delivery-projection/service';
import type { DeliveryGraphQlContext } from './delivery-schema';

export interface DeliveryProjectRecord {
  id: string;
  repoUrl: string | null;
  defaultBranch: string;
  settings: unknown;
}

export interface DeliveryPersistedQuery {
  id: string;
  query: string;
  sha256: string;
  operationName?: string;
  createdAt?: string;
}

export interface DeliveryProjectionSnapshot {
  projectId: string;
  branch: string;
  revision: string;
  recordCount: number;
  lastProjectedAt: Date;
}

type DeliverySettings = Record<string, unknown>;

function getDeliveryApiKey(req: Request): string | null {
  const directHeader = req.headers['x-oricms-delivery-key'];
  if (typeof directHeader === 'string' && directHeader.trim()) {
    return directHeader.trim();
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export function createDeliveryEtag(input: string): string {
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  return `"${hash}"`;
}

export function matchesIfNoneMatch(ifNoneMatch: unknown, etag: string): boolean {
  if (typeof ifNoneMatch !== 'string') return false;
  return ifNoneMatch
    .split(',')
    .map((value) => value.trim())
    .some((candidate) => candidate === etag || candidate === '*');
}

function isPersistedQuery(value: unknown): value is DeliveryPersistedQuery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && typeof record.query === 'string'
    && typeof record.sha256 === 'string';
}

export function getDeliveryPersistedQuerySettings(settings: DeliverySettings): {
  enabled: boolean;
  requirePersistedOnly: boolean;
  queries: DeliveryPersistedQuery[];
} {
  const graphqlSettings = settings.graphql;
  if (!graphqlSettings || typeof graphqlSettings !== 'object' || Array.isArray(graphqlSettings)) {
    return { enabled: false, requirePersistedOnly: false, queries: [] };
  }

  const persisted = (graphqlSettings as Record<string, unknown>).deliveryPersistedQueries;
  if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted)) {
    return { enabled: false, requirePersistedOnly: false, queries: [] };
  }

  const persistedRecord = persisted as Record<string, unknown>;
  const queries = Array.isArray(persistedRecord.queries)
    ? persistedRecord.queries.filter(isPersistedQuery)
    : [];
  return {
    enabled: persistedRecord.enabled === true,
    requirePersistedOnly: persistedRecord.requirePersistedOnly === true,
    queries,
  };
}

export function resolveDeliveryQueryPayload(
  rawQuery: string | undefined,
  rawOperationName: string | undefined,
  persistedQueryId: string | undefined,
  persistedSettings: { enabled: boolean; requirePersistedOnly: boolean; queries: DeliveryPersistedQuery[] },
): { ok: true; query: string; operationName?: string } | { ok: false; code: string; message: string } {
  if (!persistedSettings.enabled) {
    if (!rawQuery?.trim()) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'GraphQL query payload is invalid',
      };
    }
    return { ok: true, query: rawQuery, operationName: rawOperationName };
  }

  if (persistedQueryId) {
    const entry = persistedSettings.queries.find((item) => item.id === persistedQueryId);
    if (!entry) {
      return {
        ok: false,
        code: 'PERSISTED_QUERY_NOT_FOUND',
        message: 'Persisted query ID is not allowlisted',
      };
    }
    return {
      ok: true,
      query: entry.query,
      operationName: rawOperationName || entry.operationName,
    };
  }

  if (persistedSettings.requirePersistedOnly) {
    return {
      ok: false,
      code: 'PERSISTED_QUERY_REQUIRED',
      message: 'Delivery endpoint requires persisted query IDs',
    };
  }

  if (!rawQuery?.trim()) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'GraphQL query payload is invalid',
    };
  }

  const rawHash = crypto.createHash('sha256').update(rawQuery).digest('hex');
  const allowed = persistedSettings.queries.some((item) => item.sha256 === rawHash);
  if (!allowed) {
    return {
      ok: false,
      code: 'PERSISTED_QUERY_NOT_ALLOWED',
      message: 'GraphQL query is not in the delivery allowlist',
    };
  }

  return { ok: true, query: rawQuery, operationName: rawOperationName };
}

function validateDeliveryAccessOrRespond(
  req: Request,
  res: Response,
  project: DeliveryProjectRecord | null,
): { ok: true; settings: DeliverySettings } | { ok: false } {
  if (!project) {
    res.status(404).json({
      success: false,
      error: {
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found',
      },
    });
    return { ok: false };
  }

  const settings = (project.settings || {}) as DeliverySettings;
  const requireDeliveryApiKey = settings.requireDeliveryApiKey ?? true;
  const deliveryApiKeyHash = settings.deliveryApiKeyHash as string | undefined;
  if (requireDeliveryApiKey) {
    if (!deliveryApiKeyHash) {
      res.status(503).json({
        success: false,
        error: { code: 'DELIVERY_KEY_NOT_CONFIGURED', message: 'Delivery API key is not configured' },
      });
      return { ok: false };
    }

    const providedKey = getDeliveryApiKey(req);
    if (!providedKey) {
      res.status(401).json({
        success: false,
        error: { code: 'MISSING_DELIVERY_KEY', message: 'Delivery API key is required' },
      });
      return { ok: false };
    }

    const providedHash = crypto.createHash('sha256').update(providedKey).digest('hex');
    const expectedBuffer = Buffer.from(deliveryApiKeyHash, 'hex');
    const providedBuffer = Buffer.from(providedHash, 'hex');
    if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_DELIVERY_KEY', message: 'Invalid delivery API key' },
      });
      return { ok: false };
    }
  }

  return { ok: true, settings };
}

export async function getAccessibleDeliveryProject(
  req: Request,
  res: Response,
  projectId: string,
): Promise<{ project: DeliveryProjectRecord; settings: DeliverySettings } | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  }) as DeliveryProjectRecord | null;

  const access = validateDeliveryAccessOrRespond(req, res, project);
  if (!access.ok || !project) {
    return null;
  }

  return {
    project,
    settings: access.settings,
  };
}

export async function loadDeliverySnapshot(context: DeliveryGraphQlContext): Promise<DeliveryProjectionSnapshot> {
  const projectionService = new DeliveryProjectionService({
    projectId: context.projectId,
    repoUrl: context.repoUrl,
    branch: context.defaultBranch,
  });
  const snapshot = await projectionService.ensureCurrent();
  return {
    projectId: snapshot.projectId,
    branch: snapshot.branch,
    revision: snapshot.revision,
    recordCount: snapshot.recordCount,
    lastProjectedAt: snapshot.lastProjectedAt,
  };
}

export async function executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`GraphQL execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
