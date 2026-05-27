import {
  getCollectionBrowseFields,
  getPreferredFieldKey as getSharedPreferredFieldKey,
  resolveFieldCapability,
} from '@ori/shared';
import type { CollectionEntry, ContentType, SchemaField } from '@ori/shared';

export function getCollectionBrowseSearchFields(contentType: ContentType | null, maxFields = 3): SchemaField[] {
  return getCollectionBrowseFields(contentType, maxFields);
}

export function getPreferredFieldKey(contentType: ContentType | null, candidates: string[]): string | null {
  return getSharedPreferredFieldKey(contentType, candidates);
}

export function matchesCollectionBrowseSearch(
  entry: CollectionEntry,
  search: string,
  contentType: ContentType,
  relationLabelsByField: Record<string, Record<string, string>> = {},
): boolean {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return true;

  const browseFields = getCollectionBrowseSearchFields(contentType);
  if (!browseFields.length) {
    return String(entry.$id || '').toLowerCase().includes(normalizedSearch);
  }

  return browseFields.some((field) =>
    resolveFieldCapability({
      field,
      fieldType: field.type,
      value: entry[field.key],
      context: { relationLabels: relationLabelsByField[field.key] },
    }).searchTokens.some((token) =>
      token.toLowerCase().includes(normalizedSearch),
    ),
  );
}
