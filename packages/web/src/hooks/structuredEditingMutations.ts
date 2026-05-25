import type { CollectionEntry, ComponentSchema, SchemaField } from '@ori/shared';
import { moveArrayItem } from '../lib/array-move';
import { createStructuredValueFromSchemaFields } from '../lib/schemas/factory';
import { deepClone } from './structuredEditingSupport';

function cloneObjectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function cloneArrayValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? [...(value as T[])] : [];
}

export function patchObjectChild(
  previous: CollectionEntry | null,
  fieldKey: string,
  childKey: string,
  value: unknown,
  fallbackObject: Record<string, unknown> = {},
) {
  if (!previous) return previous;
  const nextValue = previous[fieldKey] && typeof previous[fieldKey] === 'object' && !Array.isArray(previous[fieldKey])
    ? { ...(previous[fieldKey] as Record<string, unknown>) }
    : { ...fallbackObject };
  nextValue[childKey] = value;
  return { ...previous, [fieldKey]: nextValue };
}

export function patchIndexedObjectChild(
  previous: CollectionEntry | null,
  fieldKey: string,
  index: number,
  childKey: string,
  value: unknown,
) {
  if (!previous) return previous;
  const nextItems = cloneArrayValue<Record<string, unknown>>(previous[fieldKey]);
  const currentItem = nextItems[index] && typeof nextItems[index] === 'object' ? { ...nextItems[index] } : {};
  currentItem[childKey] = value;
  nextItems[index] = currentItem;
  return { ...previous, [fieldKey]: nextItems };
}

export function addRepeatableStructuredItem(
  previous: CollectionEntry | null,
  fieldKey: string,
  schema: ComponentSchema,
  includeType = false,
) {
  if (!previous) return previous;
  const nextItems = cloneArrayValue<Record<string, unknown>>(previous[fieldKey]);
  const nextItem = createStructuredValueFromSchemaFields(schema.fields);
  nextItems.push(includeType ? { $type: schema.$id, ...nextItem } : nextItem);
  return { ...previous, [fieldKey]: nextItems };
}

export function removeIndexedStructuredItem(previous: CollectionEntry | null, fieldKey: string, index: number) {
  if (!previous) return previous;
  const nextItems = cloneArrayValue(previous[fieldKey]);
  nextItems.splice(index, 1);
  return { ...previous, [fieldKey]: nextItems };
}

export function duplicateIndexedStructuredItem(previous: CollectionEntry | null, fieldKey: string, index: number) {
  if (!previous) return previous;
  const nextItems = cloneArrayValue(previous[fieldKey]);
  const source = nextItems[index];
  if (!source) return previous;
  nextItems.splice(index + 1, 0, deepClone(source));
  return { ...previous, [fieldKey]: nextItems };
}

export function reorderIndexedStructuredItem(previous: CollectionEntry | null, fieldKey: string, fromIndex: number, targetIndex: number) {
  if (!previous || fromIndex === targetIndex) return previous;
  const items = cloneArrayValue(previous[fieldKey]);
  return { ...previous, [fieldKey]: moveArrayItem(items, fromIndex, targetIndex) };
}

export function patchArrayItem(previous: CollectionEntry | null, fieldKey: string, index: number, value: unknown) {
  if (!previous) return previous;
  const nextItems = cloneArrayValue(previous[fieldKey]);
  nextItems[index] = value;
  return { ...previous, [fieldKey]: nextItems };
}

export function addArrayItem(previous: CollectionEntry | null, fieldKey: string, sample?: unknown) {
  if (!previous) return previous;
  const nextItems = cloneArrayValue(previous[fieldKey]);
  const nextValue = typeof sample === 'number' ? 0 : typeof sample === 'boolean' ? false : '';
  nextItems.push(nextValue);
  return { ...previous, [fieldKey]: nextItems };
}

export function duplicateArrayItem(previous: CollectionEntry | null, fieldKey: string, index: number) {
  if (!previous) return previous;
  const nextItems = cloneArrayValue(previous[fieldKey]);
  if (index < 0 || index >= nextItems.length) return previous;
  nextItems.splice(index + 1, 0, deepClone(nextItems[index]));
  return { ...previous, [fieldKey]: nextItems };
}

export function buildObjectFieldFallback(editorFields: SchemaField[], fieldKey: string) {
  const schemaField = editorFields.find((field) => field.key === fieldKey);
  return schemaField?.fields?.length ? createStructuredValueFromSchemaFields(schemaField.fields) : {};
}

export function patchComponentRoot(previous: CollectionEntry | null, fieldKey: string, childKey: string, value: unknown) {
  if (!previous) return previous;
  const nextValue = cloneObjectValue(previous[fieldKey]);
  nextValue[childKey] = value;
  return { ...previous, [fieldKey]: nextValue };
}
