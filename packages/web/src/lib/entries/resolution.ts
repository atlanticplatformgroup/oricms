import type { Asset, CollectionConfig, CollectionEntry, ContentType, SchemaField } from '@ori/shared';
import { getCollectionBrowseFields, getPreferredFieldKey } from '@ori/shared';
import { resolveRegisteredFieldCapability } from '../fields/capabilities';
import type { CollectionBrowsePreview, CollectionTableColumn } from './types';
import { inferFallbackEditorField, getRefId } from './transforms';

export function resolveContentType(collection: CollectionConfig | null, contentTypes: ContentType[]): ContentType | null {
  if (!collection) return null;
  return (
    contentTypes.find((contentType) => contentType.$id === collection.contentType) ||
    contentTypes.find((contentType) => contentType.name === collection.contentType) ||
    null
  );
}

export function getPreferredField(contentType: ContentType | null, fieldCandidates: string[]): string | null {
  return getPreferredFieldKey(contentType, fieldCandidates);
}

export function getCollectionTableColumns(contentType: ContentType | null, maxColumns = 3): CollectionTableColumn[] {
  if (!contentType?.fields?.length) {
    return [{ key: '$id', label: 'Entry ID', fieldType: '$id' }];
  }

  const browseFields = getCollectionBrowseFields(contentType, maxColumns);
  return browseFields.length
    ? browseFields.map((field) => ({ key: field.key, label: field.label, fieldType: field.type, field }))
    : [{ key: '$id', label: 'Entry ID', fieldType: '$id' }];
}

function isIdentifierField(field: SchemaField | undefined): boolean {
  if (!field) return false;
  return field.type === 'uid' || /(slug|path|id)$/i.test(field.key);
}

function isSummaryCandidateField(field: SchemaField | undefined): boolean {
  if (!field) return false;
  return (
    field.type === 'string' ||
    field.type === 'text' ||
    field.type === 'textarea' ||
    field.type === 'markdown' ||
    field.type === 'richtext' ||
    field.type === 'email' ||
    field.type === 'url' ||
    field.type === 'relation' ||
    field.type === 'reference' ||
    field.type === 'enum' ||
    field.type === 'select' ||
    field.type === 'number'
  );
}

function normalizePreviewText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function resolvePreviewFieldText({
  field,
  entry,
  tableAssetMap,
  relationLabelsByField,
}: {
  field: SchemaField;
  entry: CollectionEntry;
  tableAssetMap?: Map<string, Asset>;
  relationLabelsByField?: Record<string, Record<string, string>>;
}): string {
  const capability = resolveRegisteredFieldCapability({
    field,
    fieldType: field.type,
    value: entry[field.key],
    context: {
      assetMap: tableAssetMap,
      relationLabels: relationLabelsByField?.[field.key],
    },
  });

  return normalizePreviewText(capability.readonly.text || capability.displayText || '');
}

export function resolveCollectionBrowsePreview({
  contentType,
  entry,
  tableAssetMap,
  relationLabelsByField,
}: {
  contentType: ContentType | null;
  entry: CollectionEntry;
  tableAssetMap?: Map<string, Asset>;
  relationLabelsByField?: Record<string, Record<string, string>>;
}): CollectionBrowsePreview {
  if (!contentType?.fields?.length) {
    return {
      primary: entry.$id,
      summary: null,
      tertiary: null,
    };
  }

  const nonEmptyFields = contentType.fields
    .map((field) => ({
      field,
      text: resolvePreviewFieldText({ field, entry, tableAssetMap, relationLabelsByField }),
    }))
    .filter((item) => item.text.length > 0);

  const primaryField = contentType.fields.find((field) => field.key === contentType.display?.primary && !isIdentifierField(field))
    ?? nonEmptyFields.find((item) => !isIdentifierField(item.field))?.field
    ?? contentType.fields[0];

  const primary = primaryField
    ? (nonEmptyFields.find((item) => item.field.key === primaryField.key)?.text || entry.$id)
    : entry.$id;

  const preferredSummaryField = contentType.fields.find((field) => field.key === contentType.display?.secondary);
  const summary = nonEmptyFields.find((item) => {
    if (item.field.key === primaryField?.key) return false;
    if (item.text === primary) return false;
    if (preferredSummaryField && item.field.key === preferredSummaryField.key && !isIdentifierField(item.field)) return true;
    return false;
  })?.text
    ?? nonEmptyFields.find((item) => {
      if (item.field.key === primaryField?.key) return false;
      if (item.text === primary) return false;
      if (isIdentifierField(item.field)) return false;
      return isSummaryCandidateField(item.field);
    })?.text
    ?? null;

  const tertiary = summary
    ? null
    : nonEmptyFields.find((item) => {
      if (item.field.key === primaryField?.key) return false;
      if (item.text === primary) return false;
      return isIdentifierField(item.field);
    })?.text ?? null;

  return {
    primary,
    summary,
    tertiary,
  };
}

export function getEditorFields(contentType: ContentType | null, entry: CollectionEntry | null): SchemaField[] {
  if (contentType?.fields?.length) return contentType.fields;
  if (!entry) return [];

  return Object.keys(entry)
    .filter((key) => !key.startsWith('$'))
    .map((key) => inferFallbackEditorField(entry, key));
}

export function resolveTargetCollectionId(field: SchemaField, collections: CollectionConfig[]): string | null {
  const targetHint = field.relation?.target || field.options?.referenceCollection;
  if (!targetHint) return null;

  const byId = collections.find((collection) => collection.id === targetHint);
  if (byId) return byId.id;

  const byContentType = collections.find((collection) => collection.contentType === targetHint);
  if (byContentType) return byContentType.id;

  return null;
}

export function isMultiRelationField(field: SchemaField): boolean {
  if (field.multiple || field.options?.multiple) return true;

  const relationType = field.relation?.type;
  return relationType === 'oneToMany' || relationType === 'manyToMany';
}

export function getRelationDisplayLabel(value: unknown, relationLabels?: Record<string, string>): string {
  const id = getRefId(value);
  if (!id) return '';
  return relationLabels?.[id] || id;
}
