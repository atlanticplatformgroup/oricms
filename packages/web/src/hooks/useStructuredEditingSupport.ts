import type { ComponentSchema, CollectionEntry, SchemaField } from '@ori/shared';
import type { StructuredDragItem } from '../lib/entries/types';
import { getEditorFieldError, getStructuredFieldValidationIssues } from '../lib/entries/editor';

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getStructuredItemKey(item: StructuredDragItem) {
  return `${item.kind}:${item.fieldKey}:${item.index}`;
}

export function getStructuredItemTitle(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const candidates = ['title', 'label', 'name', 'headline', 'question', 'quote'];
    for (const key of candidates) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
  }
  return fallback;
}

export function getStructuredItemState(input: {
  baselineEntry: CollectionEntry | null;
  collapsedStructuredItems: Record<string, boolean>;
  componentSchemaMap: Map<string, ComponentSchema>;
  draftEntry: CollectionEntry | null;
  editorFields: SchemaField[];
  item: StructuredDragItem;
}) {
  const { baselineEntry, collapsedStructuredItems, componentSchemaMap, draftEntry, editorFields, item } = input;
  const collapsed = Boolean(collapsedStructuredItems[getStructuredItemKey(item)]);

  if (!draftEntry) {
    return { collapsed, changed: false, invalid: false };
  }

  const currentValue = Array.isArray(draftEntry[item.fieldKey]) ? (draftEntry[item.fieldKey] as unknown[])[item.index] : null;
  const baselineValue = baselineEntry && Array.isArray(baselineEntry[item.fieldKey]) ? (baselineEntry[item.fieldKey] as unknown[])[item.index] : null;
  const changed = JSON.stringify(currentValue ?? null) !== JSON.stringify(baselineValue ?? null);

  let invalid = false;
  const topLevelField = editorFields.find((field) => field.key === item.fieldKey);
  if (topLevelField?.type === 'component') {
    const componentId = topLevelField.component || '';
    const componentSchema = componentId ? componentSchemaMap.get(componentId) ?? null : null;
    if (componentSchema && currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
      invalid = getStructuredFieldValidationIssues(componentSchema.fields, currentValue) > 0;
    }
  } else if (topLevelField?.type === 'blocks') {
    const block = currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue) ? currentValue as Record<string, unknown> : null;
    const schema = typeof block?.$type === 'string' ? componentSchemaMap.get(block.$type) ?? null : null;
    if (schema && block) {
      invalid = getStructuredFieldValidationIssues(schema.fields, block) > 0;
    }
  } else if (topLevelField?.type === 'array') {
    const itemLabel = `${topLevelField.label || topLevelField.key} ${item.index + 1}`;
    const itemType = typeof currentValue === 'number' || typeof currentValue === 'boolean' ? typeof currentValue : 'string';
    invalid = Boolean(
      itemType === 'string'
        ? getEditorFieldError({ ...topLevelField, key: itemLabel, label: itemLabel, type: 'string', required: topLevelField.required } as SchemaField, currentValue)
        : null,
    );
  }

  return { collapsed, changed, invalid };
}

export function getStructuredValidationCount(input: {
  componentSchemaMap: Map<string, ComponentSchema>;
  draftEntry: CollectionEntry | null;
  editorFields: SchemaField[];
}) {
  const { componentSchemaMap, draftEntry, editorFields } = input;
  if (!draftEntry) return 0;

  return editorFields.reduce((count, field) => {
    const currentValue = draftEntry[field.key];

    if (field.type === 'component') {
      const componentId = field.component || '';
      const componentSchema = componentId ? componentSchemaMap.get(componentId) ?? null : null;
      if (!componentSchema) return count;

      if (field.repeatable) {
        const items = Array.isArray(currentValue) ? currentValue : [];
        return count + items.reduce((itemCount, item) => itemCount + getStructuredFieldValidationIssues(componentSchema.fields, item), 0);
      }

      if (currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
        return count + getStructuredFieldValidationIssues(componentSchema.fields, currentValue);
      }
    }

    if (field.type === 'object' && field.fields?.length && currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
      return count + getStructuredFieldValidationIssues(field.fields, currentValue);
    }

    if (field.type === 'blocks') {
      const blocks = Array.isArray(currentValue) ? currentValue : [];
      return count + blocks.reduce((blockCount, block) => {
        const schema = typeof block?.$type === 'string' ? componentSchemaMap.get(block.$type) ?? null : null;
        return blockCount + (schema ? getStructuredFieldValidationIssues(schema.fields, block) : 0);
      }, 0);
    }

    if (field.type === 'array' && Array.isArray(currentValue) && field.required) {
      return count + currentValue.filter((item) => typeof item === 'string' && !item.trim()).length;
    }

    return count;
  }, 0);
}
