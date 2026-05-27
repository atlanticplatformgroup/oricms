import { getAssetTags } from './asset-metadata';
import { getAssetReferenceIdentifier, normalizeAssetReference } from './asset-references';
import type { Asset, ContentType, SchemaField } from './types';

export type FieldCapabilityFieldType = SchemaField['type'] | '$id';

export interface FieldCapabilityContext {
  assetMap?: Map<string, Asset>;
  relationLabels?: Record<string, string>;
}

export interface FieldCapabilityInput {
  field?: SchemaField;
  fieldType: FieldCapabilityFieldType;
  value: unknown;
  context?: FieldCapabilityContext;
}

export interface FieldReadonlyDescriptor {
  text: string;
  empty: boolean;
}

export interface FieldRelationResolutionHint {
  targetHint: string | null;
}

export interface FieldCapabilityResult {
  listEligible: boolean;
  displayText: string;
  sortToken: string;
  searchTokens: string[];
  readonly: FieldReadonlyDescriptor;
  relation?: FieldRelationResolutionHint | null;
}

const LIST_ELIGIBLE_FIELD_TYPES = new Set<SchemaField['type']>([
  'string',
  'text',
  'textarea',
  'number',
  'boolean',
  'datetime',
  'date',
  'enum',
  'select',
  'uid',
  'email',
  'url',
  'color',
  'relation',
  'reference',
  'image',
  'media',
]);

export function isFieldListEligible(field?: SchemaField): boolean {
  return Boolean(field && LIST_ELIGIBLE_FIELD_TYPES.has(field.type));
}

export function getPreferredFieldKey(contentType: ContentType | null, candidates: string[]): string | null {
  if (!contentType) return null;

  const preferred = candidates.find((candidate) => contentType.fields.some((field) => field.key === candidate));
  return preferred || contentType.fields[0]?.key || null;
}

export function getCollectionBrowseFields(contentType: ContentType | null, maxFields = 3): SchemaField[] {
  if (!contentType?.fields?.length) {
    return [];
  }

  const fields: SchemaField[] = [];
  const seen = new Set<string>();

  const pushField = (field: SchemaField | undefined) => {
    if (!field || seen.has(field.key) || !isFieldListEligible(field)) return;
    seen.add(field.key);
    fields.push(field);
  };

  pushField(contentType.fields.find((field) => field.key === contentType.display?.primary));
  pushField(contentType.fields.find((field) => field.key === contentType.display?.secondary));

  for (const field of contentType.fields) {
    if (fields.length >= maxFields) break;
    pushField(field);
  }

  if (fields.length) {
    return fields.slice(0, maxFields);
  }

  return contentType.fields[0] ? [contentType.fields[0]] : [];
}

export function getFieldChoiceLabel(field: SchemaField | undefined, value: unknown): string {
  const rawValue = toDisplayText(value);
  if (!field || !rawValue) return rawValue;

  const choices = [...(field.enumValues || []), ...(field.options?.choices || [])];
  return choices.find((choice) => choice.value === rawValue)?.label || rawValue;
}

export function getRefId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  if (typeof record.$id === 'string') return record.$id;
  if (typeof record.id === 'string') return record.id;
  if (typeof record.value === 'string') return record.value;
  return '';
}

export function getRefIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => getRefId(item)).filter(Boolean);
  }

  const single = getRefId(value);
  return single ? [single] : [];
}

export function resolveFieldCapability(input: FieldCapabilityInput): FieldCapabilityResult {
  const { field, fieldType, value, context = {} } = input;
  const relation = fieldType === 'relation' || fieldType === 'reference'
    ? { targetHint: field?.relation?.target || field?.options?.referenceCollection || null }
    : null;

  if (value === null || value === undefined || value === '') {
    return {
      listEligible: fieldType === '$id' || isFieldListEligible(field),
      displayText: '',
      sortToken: '',
      searchTokens: [],
      readonly: { text: '', empty: true },
      relation,
    };
  }

  if (fieldType === '$id') {
    const text = typeof value === 'string' ? value : toDisplayText(value);
    return {
      listEligible: true,
      displayText: text,
      sortToken: text,
      searchTokens: text ? [text] : [],
      readonly: { text, empty: !text },
      relation: null,
    };
  }

  if (fieldType === 'relation' || fieldType === 'reference') {
    const refIds = getRefIds(value);
    const displayParts = refIds.map((refId) => context.relationLabels?.[refId] || refId).filter(Boolean);
    const text = displayParts.join(', ');
    return {
      listEligible: isFieldListEligible(field),
      displayText: text,
      sortToken: displayParts.join(' '),
      searchTokens: dedupe(refIds.flatMap((refId) => [context.relationLabels?.[refId] || '', refId])),
      readonly: { text, empty: displayParts.length === 0 },
      relation,
    };
  }

  if (fieldType === 'enum' || fieldType === 'select') {
    const values = Array.isArray(value) ? value : [value];
    const labels = values.map((item) => getFieldChoiceLabel(field, item)).filter(Boolean);
    const rawValues = values.map((item) => toDisplayText(item)).filter(Boolean);
    const text = labels.join(', ');
    return {
      listEligible: isFieldListEligible(field),
      displayText: text,
      sortToken: labels.join(' '),
      searchTokens: dedupe([...labels, ...rawValues]),
      readonly: { text, empty: labels.length === 0 },
      relation: null,
    };
  }

  if (fieldType === 'boolean') {
    const text = value ? 'Yes' : 'No';
    return {
      listEligible: isFieldListEligible(field),
      displayText: text,
      sortToken: text,
      searchTokens: value ? ['Yes', 'True'] : ['No', 'False'],
      readonly: { text, empty: false },
      relation: null,
    };
  }

  if (fieldType === 'date' || fieldType === 'datetime') {
    const text = formatDateDisplay(value);
    const sortToken = formatDateSortToken(value);
    return {
      listEligible: isFieldListEligible(field),
      displayText: text,
      sortToken,
      searchTokens: text ? dedupe([text, sortToken]) : [],
      readonly: { text, empty: !text },
      relation: null,
    };
  }

  if ((fieldType === 'media' || fieldType === 'image') && Array.isArray(value)) {
    const assets = value
      .map((item) => resolveAssetText(item, context.assetMap))
      .filter((item): item is { display: string; searchTokens: string[] } => Boolean(item));
    const text = assets.map((asset) => asset.display).join(', ');
    return {
      listEligible: isFieldListEligible(field),
      displayText: text,
      sortToken: text,
      searchTokens: dedupe(assets.flatMap((asset) => asset.searchTokens)),
      readonly: { text, empty: assets.length === 0 },
      relation: null,
    };
  }

  if (fieldType === 'media' || fieldType === 'image') {
    const asset = resolveAssetText(value, context.assetMap);
    if (!asset) {
      return {
        listEligible: isFieldListEligible(field),
        displayText: '',
        sortToken: '',
        searchTokens: [],
        readonly: { text: '', empty: true },
        relation: null,
      };
    }
    const text = asset.display || getAssetReferenceIdentifier(value);
    return {
      listEligible: isFieldListEligible(field),
      displayText: text,
      sortToken: text,
      searchTokens: asset?.searchTokens || [getAssetReferenceIdentifier(value)],
      readonly: { text, empty: false },
      relation: null,
    };
  }

  if (Array.isArray(value)) {
    const tokens = value.map((item) => toDisplayText(item)).filter(Boolean);
    const text = tokens.join(', ');
    return {
      listEligible: isFieldListEligible(field),
      displayText: text,
      sortToken: text,
      searchTokens: dedupe(tokens),
      readonly: { text, empty: tokens.length === 0 },
      relation: null,
    };
  }

  if (typeof value === 'object') {
    const text = JSON.stringify(value);
    return {
      listEligible: isFieldListEligible(field),
      displayText: text,
      sortToken: text,
      searchTokens: [],
      readonly: { text, empty: !text },
      relation: null,
    };
  }

  const text = toDisplayText(value);
  return {
    listEligible: isFieldListEligible(field),
    displayText: text,
    sortToken: text,
    searchTokens: text ? [text] : [],
    readonly: { text, empty: !text },
    relation: null,
  };
}

function resolveAssetText(value: unknown, assetMap?: Map<string, Asset>) {
  const reference = normalizeAssetReference(value);
  if (!reference) return null;

  if (reference.scope === 'global') {
    const asset = assetMap?.get(reference.assetId);
    const display = asset?.name || getBasename(reference.assetId) || reference.assetId;
    return {
      display,
      searchTokens: dedupe([
        display,
        reference.assetId,
        asset?.metadata?.altText || '',
        ...getAssetTags(asset?.metadata),
        'global',
      ]),
    };
  }

  const assetPath = reference.path;
  const asset = assetMap?.get(assetPath);
  const display = asset?.name || getBasename(assetPath) || assetPath;
  return {
    display,
    searchTokens: dedupe([
      display,
      assetPath,
      asset?.metadata?.altText || '',
      ...getAssetTags(asset?.metadata),
      asset?.folder || '',
    ]),
  };
}

function getBasename(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).pop() || value;
}

function formatDateDisplay(value: unknown): string {
  if (typeof value !== 'string' && !(value instanceof Date)) return toDisplayText(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toDisplayText(value);
  return date.toLocaleDateString();
}

function formatDateSortToken(value: unknown): string {
  if (typeof value !== 'string' && !(value instanceof Date)) return toDisplayText(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toDisplayText(value);
  return date.toISOString();
}

function toDisplayText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
