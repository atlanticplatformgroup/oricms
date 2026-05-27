import type { ContentType, SchemaField } from '@ori/shared';
import type { EditorFieldSection } from './types';
import { toLabel } from '../workspace/format';
import { isEmptyFieldValue } from './transforms';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UNGROUPED_EDITOR_SECTION_ID = '__ungrouped';
const DEFAULT_HALF_WIDTH_FIELD_TYPES = new Set<SchemaField['type']>([
  'number',
  'boolean',
  'date',
  'datetime',
  'email',
  'password',
  'enum',
  'select',
]);

export function resolveEditorSections(contentType: ContentType | null | undefined, fields: SchemaField[]): EditorFieldSection[] {
  if (!fields.length) return [];

  const configuredSections = contentType?.editor?.sections ?? [];
  if (!configuredSections.length) {
    return [{ id: UNGROUPED_EDITOR_SECTION_ID, fields }];
  }

  const sections: EditorFieldSection[] = configuredSections.map((section) => ({
    id: section.id,
    title: section.label,
    description: section.description,
    collapsible: section.collapsible ?? true,
    defaultCollapsed: Boolean(section.defaultCollapsed),
    fields: [],
  }));

  const sectionMap = new Map(sections.map((section) => [section.id, section] as const));
  const ungroupedFields: SchemaField[] = [];

  fields.forEach((field) => {
    const sectionId = field.options?.editor?.section;
    if (!sectionId) {
      ungroupedFields.push(field);
      return;
    }

    const section = sectionMap.get(sectionId);
    if (!section) {
      ungroupedFields.push(field);
      return;
    }

    section.fields.push(field);
  });

  const resolvedSections = sections.filter((section) => section.fields.length > 0);
  if (ungroupedFields.length > 0) {
    resolvedSections.push({
      id: UNGROUPED_EDITOR_SECTION_ID,
      fields: ungroupedFields,
    });
  }

  return resolvedSections.length > 0 ? resolvedSections : [{ id: UNGROUPED_EDITOR_SECTION_ID, fields }];
}

export function resolveEditorFieldWidth(field: SchemaField): 'full' | 'half' {
  const explicitWidth = field.options?.editor?.width;
  if (explicitWidth === 'full' || explicitWidth === 'half') {
    return explicitWidth;
  }

  return DEFAULT_HALF_WIDTH_FIELD_TYPES.has(field.type) ? 'half' : 'full';
}

export function getEditorFieldError(field: SchemaField, value: unknown): string | null {
  if (field.required && isEmptyFieldValue(value)) {
    return `${field.label || toLabel(field.key)} is required`;
  }

  if (typeof value === 'string' && value.trim()) {
    if (field.type === 'email') {
      if (!EMAIL_PATTERN.test(value.trim())) return 'Enter a valid email address';
    }

    if (field.type === 'url') {
      try {
        new URL(value.trim());
      } catch {
        return 'Enter a valid URL';
      }
    }

    if (field.type === 'uid' || field.key === 'slug') {
      if (!IDENTIFIER_PATTERN.test(value.trim())) return 'Use lowercase letters, numbers, and hyphens only';
    }

    if (field.type === 'json' || field.type === 'object' || field.type === 'array') {
      try {
        const parsed = JSON.parse(value);
        if (field.type === 'object' && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))) {
          return 'Enter a valid JSON object';
        }
        if (field.type === 'array' && !Array.isArray(parsed)) {
          return 'Enter a valid JSON array';
        }
      } catch {
        return `Enter valid JSON for ${field.label || toLabel(field.key)}`;
      }
    }
  }

  return null;
}

export function getStructuredFieldValidationIssues(fields: SchemaField[], value: unknown): number {
  if (!value || typeof value !== 'object') return 0;

  if (Array.isArray(value)) {
    return value.reduce((count, item) => count + getStructuredFieldValidationIssues(fields, item), 0);
  }

  const record = value as Record<string, unknown>;

  return fields.reduce((count, field) => {
    const current = record[field.key];
    const ownError = getEditorFieldError(field, current) ? 1 : 0;

    if ((field.type === 'component' || field.type === 'object') && field.fields?.length && current && typeof current === 'object' && !Array.isArray(current)) {
      return count + ownError + getStructuredFieldValidationIssues(field.fields, current);
    }

    return count + ownError;
  }, 0);
}
