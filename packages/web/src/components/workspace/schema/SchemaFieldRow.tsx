import { Badge, Button, Divider, Group, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import type { DragEvent as ReactDragEvent } from 'react';
import type { FieldType, SchemaField } from '@ori/shared';
import { WorkspaceDragHandle, WorkspaceFieldGrid, WorkspaceInset, WorkspaceMetricBadge } from '../../ui/WorkspacePrimitives';
import { SchemaFieldAdvancedSettings } from './SchemaFieldAdvancedSettings';

interface SchemaFieldRowProps {
  field: SchemaField;
  fieldIssues: string[];
  strategy: { recommendation: string; detail: string; tone: 'blue' | 'orange' | 'gray' };
  isDropTarget: boolean;
  schemaFieldTypeOptions: Array<{ value: FieldType; label: string }>;
  componentSchemaOptions: Array<{ value: string; label: string }>;
  collectionOptions: Array<{ value: string; label: string }>;
  uidSourceOptions: Array<{ value: string; label: string }>;
  disabled?: boolean;
  toLabel: (value: string) => string;
  onDragStart: (event: ReactDragEvent<HTMLElement>, fieldKey: string) => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onPatch: (updater: (field: SchemaField) => SchemaField) => void;
  onTypeChange: (nextType: FieldType) => void;
  onRemove: () => void;
}

export function SchemaFieldRow({
  field,
  fieldIssues,
  strategy,
  isDropTarget,
  schemaFieldTypeOptions,
  componentSchemaOptions,
  collectionOptions,
  uidSourceOptions,
  disabled = false,
  toLabel,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onPatch,
  onTypeChange,
  onRemove,
}: SchemaFieldRowProps) {
  return (
    <Group align="flex-start" gap="sm" wrap="nowrap" onDragOver={onDragOver} onDrop={onDrop}>
      <Stack pt={4} gap="xs" align="center">
        <WorkspaceDragHandle
          label="Drag schema field"
          draggable={!disabled}
          onDragStart={(event) => onDragStart(event, field.key)}
          onDragEnd={onDragEnd}
        />
      </Stack>
      <div style={{ flex: 1, minWidth: 0 }} onDragLeave={onDragLeave}>
        <WorkspaceInset>
          <Stack
            gap="sm"
            style={isDropTarget ? { outline: '1px solid var(--mantine-color-blue-5)', borderRadius: 'var(--mantine-radius-md)' } : undefined}
          >
            <Group justify="space-between" align="flex-start" wrap="wrap" style={{ rowGap: 'var(--mantine-spacing-xs)' }}>
              <Stack gap={3} style={{ minWidth: 0, flex: 1 }}>
                <Group gap="xs" wrap="wrap">
                  <Text fw={600} size="sm">{field.label || toLabel(field.key)}</Text>
                  <Badge variant="outline" color="gray">{field.type}</Badge>
                  {field.repeatable ? <Badge variant="light" color="gray">Repeatable</Badge> : null}
                </Group>
                <Text size="xs" c="dimmed">{field.key}</Text>
                <Group gap="xs" wrap="wrap">
                  <WorkspaceMetricBadge color={strategy.tone} style={{ flexShrink: 0 }}>{strategy.recommendation}</WorkspaceMetricBadge>
                  <Text size="xs" c="dimmed" truncate="end">{strategy.detail}</Text>
                </Group>
              </Stack>
              <Group gap="xs" wrap="wrap">
                {fieldIssues.length > 0 ? <WorkspaceMetricBadge color="red">{`${fieldIssues.length} issue${fieldIssues.length === 1 ? '' : 's'}`}</WorkspaceMetricBadge> : null}
                <Button variant="subtle" color="red" size="compact-sm" disabled={disabled} onClick={onRemove}>Remove</Button>
              </Group>
            </Group>
            <Divider />
            <WorkspaceFieldGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              <TextInput
                label="Label"
                value={field.label || ''}
                disabled={disabled}
                onChange={(event) => onPatch((current) => ({ ...current, label: event.currentTarget.value }))}
              />
              <TextInput
                label="Key"
                value={field.key}
                disabled={disabled}
                onChange={(event) => {
                  const nextKey = event.currentTarget.value.replace(/[^a-zA-Z0-9_-]/g, '');
                  onPatch((current) => ({ ...current, key: nextKey || current.key }));
                }}
              />
              <Select
                label="Type"
                data={schemaFieldTypeOptions}
                value={field.type}
                disabled={disabled}
                onChange={(nextType) => {
                  if (!nextType) return;
                  onTypeChange(nextType as FieldType);
                }}
              />
            </WorkspaceFieldGrid>
            <WorkspaceFieldGrid>
              <TextInput
                label="Description"
                value={field.description || ''}
                disabled={disabled}
                onChange={(event) => onPatch((current) => ({ ...current, description: event.currentTarget.value || undefined }))}
              />
              <Switch
                label="Required"
                checked={Boolean(field.required)}
                disabled={disabled}
                onChange={(event) => onPatch((current) => ({ ...current, required: event.currentTarget.checked }))}
              />
            </WorkspaceFieldGrid>
            {fieldIssues.length > 0 ? (
              <Stack gap={4}>
                {fieldIssues.map((issue) => (
                  <Text key={issue} size="xs" c="red">{issue}</Text>
                ))}
              </Stack>
            ) : null}
            <SchemaFieldAdvancedSettings
              field={field}
              onPatch={onPatch}
              componentSchemaOptions={componentSchemaOptions}
              collectionOptions={collectionOptions}
              uidSourceOptions={uidSourceOptions}
              disabled={disabled}
            />
          </Stack>
        </WorkspaceInset>
      </div>
    </Group>
  );
}
