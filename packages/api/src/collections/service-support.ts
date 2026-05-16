import crypto from 'crypto';
import type {
  CollectionConfig,
  CollectionEntry,
  CollectionQueryResult,
  ContentType,
} from '@ori/shared';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function normalizeCollectionPath(value: string): string {
  return value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateCollectionConfigs(collections: CollectionConfig[]): CollectionConfig[] {
  const normalizedPaths = new Set<string>();

  return collections.map((collection) => {
    const normalizedPath = normalizeCollectionPath(collection.path || '');

    if (!normalizedPath) {
      throw new Error(`Collection '${collection.id}' must define a path`);
    }

    if (normalizedPath.includes('\\')) {
      throw new Error(`Collection '${collection.id}' path must use forward slashes`);
    }

    if (normalizedPath.includes('//')) {
      throw new Error(`Collection '${collection.id}' path cannot contain empty segments`);
    }

    const segments = normalizedPath.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
      throw new Error(`Collection '${collection.id}' path cannot contain '.' or '..' segments`);
    }

    if (segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) {
      throw new Error(
        `Collection '${collection.id}' path may only use letters, numbers, hyphens, underscores, and slashes`,
      );
    }

    if (normalizedPaths.has(normalizedPath)) {
      throw new Error(`Collection path '${normalizedPath}' is already in use`);
    }
    normalizedPaths.add(normalizedPath);

    return {
      ...collection,
      path: normalizedPath,
    };
  });
}

export function generateCollectionEntryId(data: Record<string, unknown>, contentType: ContentType): string {
  const uidField = contentType.fields.find((field) => field.type === 'uid' && field.uidSource);
  if (uidField?.uidSource) {
    const sourceValue = data[uidField.uidSource] as string;
    if (sourceValue) {
      return slugify(sourceValue);
    }
  }

  const titleField = contentType.fields.find((field) => field.key === 'title' || field.key === 'name');
  if (titleField && data[titleField.key]) {
    return slugify(String(data[titleField.key]));
  }

  return `${contentType.name}-${Date.now()}`;
}

export function validateCollectionEntry(entry: CollectionEntry, contentType: ContentType): void {
  for (const field of contentType.fields) {
    if (field.required && (entry[field.key] === undefined || entry[field.key] === null || entry[field.key] === '')) {
      throw new Error(`Required field '${field.label}' is missing`);
    }
  }
}

export function computeCollectionEntryRevision(entry: CollectionEntry): string {
  return crypto.createHash('sha256').update(stableStringify(entry)).digest('hex');
}

export function applyCollectionFilters(
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

export function applyCollectionSort(
  entries: CollectionEntry[],
  sort?: Record<string, 'asc' | 'desc'>,
): CollectionEntry[] {
  if (!sort || Object.keys(sort).length === 0) {
    return entries;
  }

  const [field, direction] = Object.entries(sort)[0];

  return [...entries].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    if (aVal === bVal) return 0;
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    const comparison = (aVal as string | number | boolean) < (bVal as string | number | boolean) ? -1 : 1;
    return direction === 'desc' ? -comparison : comparison;
  });
}

export function paginateCollectionEntries(
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
