import type { CollectionEntry, ContentType, SchemaField } from '@ori/shared';
import { getDisplayText } from '../lib/workspace/format';
import { deriveSchemaFieldValue } from '../lib/schemaFieldComputed';
import { getEditorFieldError } from '../lib/entries/editor';

export type IdentifierState = Record<string, { auto: boolean; sourceLabel?: string }>;
type IdentifierStrategy = Parameters<typeof deriveSchemaFieldValue>[1];

export interface DerivedIdentifierConfig {
  fieldKey: string;
  sourceKey: string;
  sourceLabel: string;
  strategy: IdentifierStrategy;
}

export function cloneEntry(entry: CollectionEntry) {
  return JSON.parse(JSON.stringify(entry)) as CollectionEntry;
}

export function buildDerivedIdentifierConfig(
  editorFields: SchemaField[],
  editorFieldMap: Map<string, SchemaField>,
): DerivedIdentifierConfig[] {
  return editorFields
    .map((field) => {
      const sourceKey =
        field.uidSource ||
        field.options?.derivedFrom ||
        ((field.key === 'slug' || field.type === 'uid') ? (editorFields.find((candidate) => ['title', 'name'].includes(candidate.key))?.key ?? null) : null);
      if (!sourceKey) return null;
      const sourceField = editorFieldMap.get(sourceKey);
        return {
          fieldKey: field.key,
          sourceKey,
          sourceLabel: sourceField?.label || sourceKey,
          strategy: (field.options?.deriveStrategy || 'slug') as IdentifierStrategy,
        };
      })
    .filter((config): config is DerivedIdentifierConfig => config !== null);
}

export function buildEditorFieldErrors(
  draftEntry: CollectionEntry | null,
  visibleEditorFields: SchemaField[],
) {
  if (!draftEntry) return {} as Record<string, string>;
  return Object.fromEntries(
    visibleEditorFields
      .map((field) => [field.key, getEditorFieldError(field, draftEntry[field.key])] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

export function buildIdentifierState(
  selectedEntry: CollectionEntry,
  derivedIdentifierConfig: DerivedIdentifierConfig[],
) {
  const next: IdentifierState = {};
  derivedIdentifierConfig.forEach((config) => {
    const currentValue = getDisplayText(selectedEntry[config.fieldKey]).trim();
    const sourceValue = selectedEntry[config.sourceKey];
    const derivedValue = sourceValue == null ? '' : deriveSchemaFieldValue(sourceValue, config.strategy);
    next[config.fieldKey] = {
      auto: !currentValue || currentValue === derivedValue,
      sourceLabel: config.sourceLabel,
    };
  });
  return next;
}

export function resolveInitialEditorValue(
  selectedContentType: ContentType | null,
  draftEntry: CollectionEntry | null,
  selectedEntry: CollectionEntry | null,
) {
  return { selectedContentType, entry: draftEntry ?? selectedEntry };
}
