import type { CollectionLookup } from '../workspace/types';

export function normalizeCollectionPath(value: string): string {
  return value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

export function getCollectionPathError(
  rawPath: string,
  collections: CollectionLookup[],
  currentCollectionId?: string,
): string | null {
  const path = normalizeCollectionPath(rawPath);

  if (!path) return 'Collection path is required';
  if (path.includes('\\')) return 'Collection path must use forward slashes';
  if (path.includes('//')) return 'Collection path cannot contain empty segments';

  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return 'Collection path cannot contain "." or ".." segments';
  }

  if (segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) {
    return 'Collection path may only use letters, numbers, hyphens, underscores, and slashes';
  }

  const duplicate = collections.some((collection) => {
    if (currentCollectionId && collection.id === currentCollectionId) return false;
    return normalizeCollectionPath(collection.path) === path;
  });
  if (duplicate) return 'Collection path is already in use';

  return null;
}
