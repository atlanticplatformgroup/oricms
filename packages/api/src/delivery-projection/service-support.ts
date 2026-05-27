import type { Prisma } from '@prisma/client';
import type { CollectionEntry, CollectionQueryResult } from '@ori/shared';

export interface ProjectionSnapshot {
  projectId: string;
  branch: string;
  revision: string;
  recordCount: number;
  lastProjectedAt: Date;
}

export function projectionKey(projectId: string, branch: string): string {
  return `${projectId}:${branch || 'main'}`;
}

export function isProjectedEntryPublished(entry: Record<string, unknown>, nowIso: string): boolean {
  const status = (entry.$status || entry.status) as string | undefined;
  if (status !== 'published') return false;

  const publishAt = (entry.$publishedAt || entry.publishedAt || entry.publishAt) as string | undefined;
  if (publishAt && publishAt > nowIso) return false;

  const unpublishAt = (entry.$unpublishedAt || entry.unpublishedAt || entry.unpublishAt) as string | undefined;
  if (unpublishAt && unpublishAt <= nowIso) return false;

  return true;
}

export function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function mapProjectionRowsToEntries(
  rows: Array<{ data: Prisma.JsonValue }>,
): CollectionEntry[] {
  return rows.map((row) => ({ ...(row.data as CollectionEntry) }));
}

export function buildProjectedRecordInput(input: {
  projectId: string;
  branch: string;
  collectionId: string;
  contentType: string;
  entry: CollectionEntry;
  projectedAt: Date;
}): Prisma.DeliveryProjectionRecordCreateManyInput {
  const { entry } = input;
  return {
    projectId: input.projectId,
    branch: input.branch,
    collectionId: input.collectionId,
    entryId: String(entry.$id),
    contentType: typeof entry.$type === 'string' ? entry.$type : input.contentType,
    slug: typeof entry.slug === 'string' ? entry.slug : null,
    publishedAt:
      typeof entry.$publishedAt === 'string'
        ? entry.$publishedAt
        : typeof entry.publishedAt === 'string'
          ? entry.publishedAt
          : typeof entry.publishAt === 'string'
            ? entry.publishAt
            : null,
    updatedAtSource:
      typeof entry.$updatedAt === 'string'
        ? entry.$updatedAt
        : typeof entry.updatedAt === 'string'
          ? entry.updatedAt
          : null,
    data: entry as unknown as Prisma.InputJsonValue,
    projectedAt: input.projectedAt,
  };
}

export function applyProjectedEntryFilters(
  entries: CollectionEntry[],
  filters?: Record<string, unknown>,
): CollectionEntry[] {
  if (!filters || Object.keys(filters).length === 0) {
    return entries;
  }

  return entries.filter((entry) => {
    for (const [key, value] of Object.entries(filters)) {
      const match = key.match(/^(.+)_(lt|lte|gt|gte|ne|in|nin)$/);

      if (match) {
        const [, field, op] = match;
        const entryValue = entry[field];

        switch (op) {
          case 'lt':
            if (!(typeof entryValue === 'number' && typeof value === 'number' && entryValue < value)) return false;
            break;
          case 'lte':
            if (!(typeof entryValue === 'number' && typeof value === 'number' && entryValue <= value)) return false;
            break;
          case 'gt':
            if (!(typeof entryValue === 'number' && typeof value === 'number' && entryValue > value)) return false;
            break;
          case 'gte':
            if (!(typeof entryValue === 'number' && typeof value === 'number' && entryValue >= value)) return false;
            break;
          case 'ne':
            if (entryValue === value) return false;
            break;
          case 'in':
            if (!(Array.isArray(value) && value.includes(entryValue))) return false;
            break;
          case 'nin':
            if (Array.isArray(value) && value.includes(entryValue)) return false;
            break;
        }
      } else if (entry[key] !== value) {
        return false;
      }
    }

    return true;
  });
}

export function applyProjectedEntrySort(
  entries: CollectionEntry[],
  sort?: Record<string, 'asc' | 'desc'>,
): CollectionEntry[] {
  if (!sort || Object.keys(sort).length === 0) {
    return entries;
  }

  const [field, direction] = Object.entries(sort)[0];
  return [...entries].sort((left, right) => {
    const leftValue = left[field];
    const rightValue = right[field];

    if (leftValue === rightValue) return 0;
    if (leftValue === undefined || leftValue === null) return 1;
    if (rightValue === undefined || rightValue === null) return -1;

    const comparison = (leftValue as string | number | boolean) < (rightValue as string | number | boolean) ? -1 : 1;
    return direction === 'desc' ? -comparison : comparison;
  });
}

export function paginateProjectedEntries(
  entries: CollectionEntry[],
  page = 1,
  limit = 20,
): CollectionQueryResult {
  const total = entries.length;
  const start = (page - 1) * limit;
  return {
    data: entries.slice(start, start + limit),
    meta: {
      pagination: {
        page,
        pageSize: limit,
        pageCount: Math.ceil(total / limit),
        total,
      },
    },
  };
}
