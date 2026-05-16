import type { SchemaField } from '@ori/shared';
import { createStructuredValueFromSchemaFields } from './schemas/factory';

type ExtendedSchemaOptions = NonNullable<SchemaField['options']> & {
  derivedFrom?: string;
  deriveStrategy?: 'slug' | 'lowercase' | 'uppercase' | 'trim';
  deriveWhen?: 'create' | 'always';
};

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function deriveSchemaFieldValue(sourceValue: unknown, strategy: 'slug' | 'lowercase' | 'uppercase' | 'trim'): string {
  const raw = String(sourceValue ?? '');
  if (strategy === 'lowercase') return raw.toLowerCase();
  if (strategy === 'uppercase') return raw.toUpperCase();
  if (strategy === 'trim') return raw.trim();
  return toSlug(raw);
}

function isValueEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}

export function getSchemaFieldDefaultValue(field: SchemaField): unknown {
  const options = (field.options || {}) as ExtendedSchemaOptions;
  if (options.defaultValue !== undefined) {
    if (field.type === 'number') {
      const numericValue = Number(options.defaultValue);
      return Number.isNaN(numericValue) ? 0 : numericValue;
    }
    if (field.type === 'boolean') {
      return Boolean(options.defaultValue);
    }
    return options.defaultValue;
  }

  switch (field.type) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return field.fields?.length ? createStructuredValueFromSchemaFields(field.fields) : {};
    default:
      return '';
  }
}

export function applyDerivedSchemaFieldValues(
  fields: SchemaField[],
  values: Record<string, unknown>,
  options: { changedKey?: string; isCreate?: boolean }
): Record<string, unknown> {
  const nextValues: Record<string, unknown> = { ...values };

  fields.forEach((field) => {
    const fieldOptions = (field.options || {}) as ExtendedSchemaOptions;
    if (!fieldOptions.derivedFrom) return;
    if (options.changedKey && fieldOptions.derivedFrom !== options.changedKey && !options.isCreate) return;

    const deriveWhen = fieldOptions.deriveWhen || 'create';
    if (deriveWhen === 'create' && !options.isCreate) return;

    const sourceValue = nextValues[fieldOptions.derivedFrom];
    if (sourceValue === undefined || sourceValue === null) return;

    if (deriveWhen === 'create' && !isValueEmpty(nextValues[field.key])) {
      return;
    }

    const strategy = fieldOptions.deriveStrategy || 'slug';
    nextValues[field.key] = deriveSchemaFieldValue(sourceValue, strategy);
  });

  return nextValues;
}

export function buildSchemaFieldDefaults(fields: SchemaField[]): Record<string, unknown> {
  const base = fields.reduce<Record<string, unknown>>((acc, field) => {
    acc[field.key] = getSchemaFieldDefaultValue(field);
    return acc;
  }, {});

  return applyDerivedSchemaFieldValues(fields, base, { isCreate: true });
}
