import crypto from 'crypto';
import type {
  AgentConfigFreshness,
  AgentEntryStatus,
  AgentMutationAction,
  AgentSessionBootstrap,
  CollectionEntry,
  ContentType,
} from '@ori/shared';
import { CollectionService } from '../collections/service';
import type { ValidationErrorDetails } from '../lib/responses';
import type { InternalAction } from './mutation-types';

export function mapAction(action: AgentMutationAction): InternalAction {
  switch (action) {
    case 'create':
      return 'CREATE';
    case 'update':
      return 'UPDATE';
    case 'delete':
      return 'DELETE';
    case 'transition':
      return 'TRANSITION';
  }

  throw new Error(`Unsupported agent mutation action: ${String(action)}`);
}

export function toEntryStatus(value: unknown): AgentEntryStatus | null {
  return value === 'published' ? 'published' : value === 'draft' ? 'draft' : null;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

export function hashPayload(value: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function computeEntryRevision(entry: CollectionEntry): string {
  return hashPayload(entry);
}

export function buildValidationError(
  details: ValidationErrorDetails,
  key: string,
  message: string,
): ValidationErrorDetails {
  const next = { ...details };
  next[key] = [...(next[key] ?? []), message];
  return next;
}

export function filterWritableData(
  input: Record<string, unknown>,
  writeConfig: { blockedFields: string[]; allowedFields: string[] },
): Record<string, unknown> {
  const filteredData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (writeConfig.blockedFields.includes(key)) continue;
    if (writeConfig.allowedFields.length > 0 && !writeConfig.allowedFields.includes(key)) continue;
    filteredData[key] = value;
  }
  return filteredData;
}

export function validateRequiredFields(
  entry: CollectionEntry,
  contentType: ContentType,
  details: ValidationErrorDetails,
): ValidationErrorDetails {
  let next = details;
  for (const field of contentType.fields) {
    if (!field.required) continue;
    const value = entry[field.key];
    if (value === undefined || value === null || value === '') {
      next = buildValidationError(next, field.key, `Required field '${field.label}' is missing`);
    }
  }
  return next;
}

export function buildCreatePreview(data: Record<string, unknown>, contentType: ContentType): CollectionEntry {
  const normalizedStatus = data.$status === 'published' ? 'published' : 'draft';
  const now = new Date().toISOString();
  return {
    ...data,
    $id: typeof data.$id === 'string' ? data.$id : typeof data.id === 'string' ? data.id : 'pending-create',
    $type: contentType.name,
    $status: normalizedStatus,
    $createdAt: now,
    $updatedAt: now,
    ...(normalizedStatus === 'published'
      ? { $publishedAt: typeof data.$publishedAt === 'string' ? data.$publishedAt : new Date().toISOString() }
      : {}),
  };
}

export function buildUpdatePreview(currentEntry: CollectionEntry, data: Record<string, unknown>): CollectionEntry {
  const next: CollectionEntry = {
    ...currentEntry,
    ...data,
  };

  if (next.$status !== 'published') {
    delete next.$publishedAt;
  } else if (typeof next.$publishedAt !== 'string') {
    next.$publishedAt = new Date().toISOString();
  }

  return next;
}

export function buildTransitionPreview(
  currentEntry: CollectionEntry,
  targetStatus: AgentEntryStatus,
): CollectionEntry {
  const next: CollectionEntry = {
    ...currentEntry,
    $status: targetStatus,
  };

  if (targetStatus === 'published') {
    next.$publishedAt = typeof currentEntry.$publishedAt === 'string'
      ? currentEntry.$publishedAt
      : new Date().toISOString();
  } else {
    delete next.$publishedAt;
  }

  return next;
}

export async function getCollectionContext(projectId: string, branch: string, collectionName: string) {
  const service = new CollectionService({ projectId, branch });
  await service.init();
  const collectionConfig = await service.getCollectionConfig(collectionName);
  if (!collectionConfig) {
    return { service, collectionConfig: null, contentType: null };
  }
  const contentType = await service.getContentType(collectionConfig.contentType);
  return { service, collectionConfig, contentType };
}

export function makeFreshness(bootstrap: AgentSessionBootstrap): AgentConfigFreshness {
  return {
    generatedAt: bootstrap.generatedAt,
    configVersion: bootstrap.configVersion,
    ...(bootstrap.configUpdatedAt ? { configUpdatedAt: bootstrap.configUpdatedAt } : {}),
  };
}
