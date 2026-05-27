import type { CollectionConfig, CollectionEntry, ContentType, SchemaField } from '@ori/shared';
import { getPreferredFieldKey, resolveFieldCapability } from '@ori/shared';
import { collectionsApi } from '../api/collections';
import { getRefIds } from '@ori/shared';
import { resolveContentType, resolveTargetCollectionId } from './resolution';

interface ResolveBrowseRelationLabelsOptions {
  projectId: string;
  fields: SchemaField[];
  entries: CollectionEntry[];
  collections: CollectionConfig[];
  contentTypes: ContentType[];
}

export type RelationOption = { value: string; label: string };

export function resolveCollectionEntryDisplay(
  entry: CollectionEntry,
  targetCollection: CollectionConfig | null,
  contentTypes: ContentType[],
): string {
  const targetType = resolveContentType(targetCollection, contentTypes);
  const targetPrimary = targetType?.display?.primary || getPreferredFieldKey(targetType, ['title', 'name', 'label']) || '$id';
  const targetField = targetType?.fields.find((candidate) => candidate.key === targetPrimary);

  return resolveFieldCapability({
    field: targetField,
    fieldType: targetField?.type || '$id',
    value: targetPrimary === '$id' ? entry.$id : entry[targetPrimary],
  }).displayText || String(entry.$id);
}

export function toRelationOption(
  entry: CollectionEntry,
  targetCollection: CollectionConfig | null,
  contentTypes: ContentType[],
): RelationOption {
  return {
    value: String(entry.$id),
    label: resolveCollectionEntryDisplay(entry, targetCollection, contentTypes),
  };
}

export async function resolveBrowseRelationLabelsByField({
  projectId,
  fields,
  entries,
  collections,
  contentTypes,
}: ResolveBrowseRelationLabelsOptions): Promise<Record<string, Record<string, string>>> {
  const relationFields = fields.filter((field) => field.type === 'relation' || field.type === 'reference');
  if (!relationFields.length || entries.length === 0) {
    return {};
  }

  const result: Record<string, Record<string, string>> = {};

  await Promise.all(
    relationFields.map(async (field) => {
      const targetCollectionId = resolveTargetCollectionId(field, collections);
      if (!targetCollectionId) {
        result[field.key] = {};
        return;
      }

      const referencedIds = Array.from(new Set(entries.flatMap((entry) => getRefIds(entry[field.key])).filter(Boolean)));
      if (!referencedIds.length) {
        result[field.key] = {};
        return;
      }

      try {
        const response = await collectionsApi.listEntries(projectId, targetCollectionId, { page: 1, limit: 500 });
        const targetCollection = collections.find((collection) => collection.id === targetCollectionId) ?? null;

        result[field.key] = Object.fromEntries(
          (response.data || [])
            .filter((entry) => referencedIds.includes(String(entry.$id)))
            .map((entry) => [String(entry.$id), toRelationOption(entry, targetCollection, contentTypes).label]),
        );
      } catch {
        result[field.key] = Object.fromEntries(referencedIds.map((id) => [id, id]));
      }
    }),
  );

  return result;
}
