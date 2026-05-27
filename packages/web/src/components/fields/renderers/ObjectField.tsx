import { memo } from 'react';
import { Alert } from '@mantine/core';
import { createStructuredValueFromSchemaFields } from '../../../lib/schemas/factory';
import { resolveEditorFieldWidth } from '../../../lib/entries/editor';
import { WorkspaceComplexFieldSurface, WorkspaceEditorFieldGrid } from '../../ui/WorkspacePrimitives';
import type { FieldRendererProps } from '../contracts';

export const ObjectField = memo(function ObjectField({ field, value, context }: FieldRendererProps) {
  const renderEmbedded = context.renderEmbeddedFieldControl;
  const actions = context.structuredActions;

  if (!field.fields?.length || !renderEmbedded) {
    return (
      <Alert color="yellow" title="Structured fields unavailable">
        This object field cannot be rendered as a structured editor until nested fields are defined.
      </Alert>
    );
  }

  const objectValue = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : createStructuredValueFromSchemaFields(field.fields);

  return (
    <WorkspaceComplexFieldSurface>
      <WorkspaceEditorFieldGrid
        items={field.fields.map((embeddedField) => ({
          key: embeddedField.key,
          width: resolveEditorFieldWidth(embeddedField),
          content: renderEmbedded(
            embeddedField,
            objectValue[embeddedField.key],
            (nextValue) => actions?.updateObjectField?.(field.key, embeddedField.key, nextValue),
          ),
        }))}
      />
    </WorkspaceComplexFieldSurface>
  );
});
