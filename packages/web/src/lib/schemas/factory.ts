import type { FieldType, SchemaField } from '@ori/shared';
import { DEFAULT_SCHEMA_FIELD_BY_TYPE, SCHEMA_FIELD_TYPE_OPTIONS } from '../workspace/constants';

export function toSchemaFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'field';
}

export function uniqueSchemaFieldKey(existing: SchemaField[], base: string): string {
  const used = new Set(existing.map((field) => field.key));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

export function makeSchemaField(type: FieldType, fields: SchemaField[], initial?: Partial<SchemaField>): SchemaField {
  const label = initial?.label || SCHEMA_FIELD_TYPE_OPTIONS.find((option) => option.value === type)?.label || 'Field';
  const key = uniqueSchemaFieldKey(fields, toSchemaFieldKey(initial?.key || label));

  return {
    key,
    label,
    type,
    required: false,
    ...DEFAULT_SCHEMA_FIELD_BY_TYPE[type],
    ...initial,
  };
}

export function createStructuredValueFromSchemaFields(fields: SchemaField[]): Record<string, unknown> {
  const nextValue: Record<string, unknown> = {};
  fields.forEach((field) => {
    if (field.default !== undefined) {
      nextValue[field.key] = field.default;
    }
  });
  return nextValue;
}
