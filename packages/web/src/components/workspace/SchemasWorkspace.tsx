import { useState, type DragEvent as ReactDragEvent } from 'react';
import { Alert, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import type { ComponentSchema, ContentType, FieldType, ResourceLock, SchemaField } from '@ori/shared';
import { WorkspaceFieldGrid, WorkspaceHeader, WorkspaceIntro, WorkspaceMain, WorkspaceMetricBadge, WorkspacePage, WorkspacePanel, WorkspaceSection } from '../ui/WorkspacePrimitives';
import { SchemaFieldRow } from './schema/SchemaFieldRow';

interface SchemasWorkspaceProps {
  activeSchemaMode: 'types' | 'components';
  onCreateSchema: () => void;
  onSaveSchema: () => void;
  onOpenDeleteSchema: () => void;
  onOpenSchemaJson: () => void;
  onOpenSchemaHistory: () => void;
  canDeleteSchema: boolean;
  canSaveSchema: boolean;
  isSchemaDirty: boolean;
  saveSchemaPending: boolean;
  selectedSchemaDocument: { path: string; schema: ContentType | ComponentSchema } | null;
  effectiveSchema: ContentType | ComponentSchema | null;
  effectiveSchemaFields: SchemaField[];
  schemaIssues: string[];
  fieldIssuesByKey: Record<string, string[]>;
  validationIssueCount: number;
  newFieldGuidance: string;
  schemaBusy: boolean;
  schemaBlockingLock: ResourceLock | null;
  schemaLockError: string | null;
  onSchemaMetaChange: (key: 'label' | 'description', value: string) => void;
  newSchemaFieldType: FieldType;
  onNewSchemaFieldTypeChange: (value: FieldType) => void;
  onAddSchemaField: () => void;
  onReorderSchemaField: (fieldKey: string, targetFieldKey: string) => void;
  onSchemaFieldPatch: (fieldKey: string, updater: (field: SchemaField) => SchemaField) => void;
  onRemoveSchemaField: (fieldKey: string) => void;
  componentSchemaOptions: Array<{ value: string; label: string }>;
  collectionOptions: Array<{ value: string; label: string }>;
  schemaFieldTypeOptions: Array<{ value: FieldType; label: string }>;
  schemaFieldTypeGroups: Array<{ group: string; items: Array<{ value: FieldType; label: string }> }>;
  toLabel: (value: string) => string;
  makeSchemaField: (type: FieldType, existingFields: SchemaField[], overrides?: Partial<SchemaField>) => SchemaField;
}

export function SchemasWorkspace(props: SchemasWorkspaceProps) {
  const {
    activeSchemaMode,
    onCreateSchema,
    onSaveSchema,
    onOpenDeleteSchema,
    onOpenSchemaJson,
    onOpenSchemaHistory,
    canDeleteSchema,
    canSaveSchema,
    isSchemaDirty,
    saveSchemaPending,
    selectedSchemaDocument,
    effectiveSchema,
    effectiveSchemaFields,
    schemaIssues,
    fieldIssuesByKey,
    validationIssueCount,
    newFieldGuidance,
    schemaBusy,
    schemaBlockingLock,
    schemaLockError,
    onSchemaMetaChange,
    newSchemaFieldType,
    onNewSchemaFieldTypeChange,
    onAddSchemaField,
    onReorderSchemaField,
    onSchemaFieldPatch,
    onRemoveSchemaField,
    componentSchemaOptions,
    collectionOptions,
    schemaFieldTypeOptions,
    schemaFieldTypeGroups,
    toLabel,
    makeSchemaField,
  } = props;
  const [draggedFieldKey, setDraggedFieldKey] = useState<string | null>(null);
  const [dropTargetFieldKey, setDropTargetFieldKey] = useState<string | null>(null);

  const getFieldStrategy = (field: SchemaField) => {
    if (field.type === 'component' && field.repeatable) {
      return {
        recommendation: 'Preferred structured repeater',
        detail: 'Use this when every repeated item should follow the same schema.',
        tone: 'blue' as const,
      };
    }
    if (field.type === 'component') {
      return {
        recommendation: 'Grouped field set',
        detail: 'Use a single reusable component when this data should stay one item.',
        tone: 'gray' as const,
      };
    }
    if (field.type === 'blocks') {
      return {
        recommendation: 'Mixed-type content zone',
        detail: 'Reserve this for ordered content areas that need multiple component types.',
        tone: 'orange' as const,
      };
    }
    if (field.type === 'array') {
      return {
        recommendation: 'Primitive list only',
        detail: 'If this becomes structured, move it to a repeatable component.',
        tone: 'gray' as const,
      };
    }
    return {
      recommendation: 'Standard field',
      detail: 'Use this for direct field editing without additional modeling structure.',
      tone: 'gray' as const,
    };
  };

  const handleFieldDragStart = (event: ReactDragEvent<HTMLElement>, fieldKey: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', fieldKey);
    setDraggedFieldKey(fieldKey);
  };

  const handleFieldDrop = (targetFieldKey: string) => {
    if (!draggedFieldKey || draggedFieldKey === targetFieldKey) {
      setDraggedFieldKey(null);
      setDropTargetFieldKey(null);
      return;
    }
    onReorderSchemaField(draggedFieldKey, targetFieldKey);
    setDraggedFieldKey(null);
    setDropTargetFieldKey(null);
  };

  return (
    <WorkspacePage>
      <WorkspaceHeader
        title="Schemas"
        description="Model the content structure for this project."
        actions={
          <>
            <Button variant="subtle" onClick={onOpenSchemaHistory} disabled={!selectedSchemaDocument}>View history</Button>
            <Button variant="subtle" onClick={onOpenSchemaJson} disabled={!effectiveSchema}>View JSON</Button>
            <Button variant="default" onClick={onCreateSchema}>
              {activeSchemaMode === 'components' ? 'New component' : 'New content type'}
            </Button>
            <Button variant="default" color="red" onClick={onOpenDeleteSchema} disabled={!canDeleteSchema || schemaBusy}>Delete schema</Button>
            <Button variant="default" onClick={onSaveSchema} disabled={!canSaveSchema || schemaBusy} loading={saveSchemaPending}>
              Save schema
            </Button>
          </>
        }
      />

      {!effectiveSchema ? (
        <WorkspaceIntro description="Choose a schema from the sidebar to inspect and edit its structure." />
      ) : (
        <WorkspaceIntro
          title={effectiveSchema.label || effectiveSchema.name || effectiveSchema.$id}
          description={
            effectiveSchema.description || (
              activeSchemaMode === 'components'
                ? 'Reusable field group for embedding inside content types.'
                : 'Content model definition for entries in this project.'
            )
          }
        >
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
              <Text size="sm" c="dimmed">{selectedSchemaDocument?.path}</Text>
              <Group gap="xs" wrap="wrap">
                {validationIssueCount > 0 ? <WorkspaceMetricBadge color="red">{`${validationIssueCount} issues`}</WorkspaceMetricBadge> : null}
                {isSchemaDirty ? <WorkspaceMetricBadge color="orange">Unsaved changes</WorkspaceMetricBadge> : null}
              </Group>
            </Group>
            <WorkspaceFieldGrid>
              <TextInput label="Label" value={effectiveSchema.label || ''} disabled={schemaBusy} onChange={(event) => onSchemaMetaChange('label', event.currentTarget.value)} />
              <TextInput label="Description" value={effectiveSchema.description || ''} disabled={schemaBusy} onChange={(event) => onSchemaMetaChange('description', event.currentTarget.value)} />
            </WorkspaceFieldGrid>
            {schemaBlockingLock ? (
              <Alert color="yellow" title={schemaBlockingLock.holderName ? `Locked by ${schemaBlockingLock.holderName}` : 'Schema locked'}>
                {schemaBlockingLock.holderName
                  ? `${schemaBlockingLock.holderName} is editing this schema. Try again after their editing session ends.`
                  : 'This schema is currently locked for editing.'}
                {schemaBlockingLock.expiresAt ? ` Retry after ${new Date(schemaBlockingLock.expiresAt).toLocaleTimeString()}.` : ''}
              </Alert>
            ) : null}
            {schemaLockError ? (
              <Alert color="red" title="Schema lock unavailable">{schemaLockError}</Alert>
            ) : null}
            {schemaIssues.length > 0 ? (
              <Alert color="red" title="Schema validation">
                <Stack gap={4}>
                  {schemaIssues.map((issue) => (
                    <Text key={issue} size="sm">{issue}</Text>
                  ))}
                </Stack>
              </Alert>
            ) : null}
          </Stack>
        </WorkspaceIntro>
      )}

      <WorkspaceMain>
        <WorkspacePanel>
          <WorkspaceSection
            title="Field builder"
            description="Define fields, order, and field-specific modeling rules."
            badge={effectiveSchema ? <WorkspaceMetricBadge>{`${effectiveSchemaFields.length} fields`}</WorkspaceMetricBadge> : undefined}
            actions={
              effectiveSchema ? (
                <Group gap="xs" align="flex-start" wrap="wrap" w="100%">
                  <Stack gap={4} miw={0} style={{ flex: '1 1 240px' }}>
                    <Select
                      size="xs"
                      value={newSchemaFieldType}
                      data={schemaFieldTypeGroups}
                      disabled={schemaBusy}
                      onChange={(value) => onNewSchemaFieldTypeChange((value as FieldType) || 'string')}
                    />
                    <Text size="xs" c="dimmed">{newFieldGuidance}</Text>
                  </Stack>
                  <Button variant="default" size="xs" onClick={onAddSchemaField} disabled={schemaBusy} style={{ flexShrink: 0 }}>Add field</Button>
                </Group>
              ) : undefined
            }
          >
            {!effectiveSchema ? (
              <Alert color="gray" title="No schema selected">Select a content type or component from the left sidebar to review its field design.</Alert>
            ) : effectiveSchemaFields.length === 0 ? (
              <Alert color="gray" title="No fields yet">This schema does not define any fields yet.</Alert>
            ) : (
              <Stack gap="xs">
                {effectiveSchemaFields.map((field) => (
                  <SchemaFieldRow
                    key={field.key}
                    field={field}
                    fieldIssues={fieldIssuesByKey[field.key] || []}
                    strategy={getFieldStrategy(field)}
                    isDropTarget={dropTargetFieldKey === field.key && draggedFieldKey !== field.key}
                    schemaFieldTypeOptions={schemaFieldTypeOptions}
                    componentSchemaOptions={componentSchemaOptions}
                    collectionOptions={collectionOptions}
                    uidSourceOptions={effectiveSchemaFields.filter((candidate) => candidate.key !== field.key).map((candidate) => ({ value: candidate.key, label: candidate.label || toLabel(candidate.key) }))}
                    disabled={schemaBusy}
                    toLabel={toLabel}
                    onDragStart={handleFieldDragStart}
                    onDragEnd={() => {
                      setDraggedFieldKey(null);
                      setDropTargetFieldKey(null);
                    }}
                    onDragOver={() => {
                      if (draggedFieldKey && draggedFieldKey !== field.key) {
                        setDropTargetFieldKey(field.key);
                      }
                    }}
                    onDragLeave={() => {
                      if (dropTargetFieldKey === field.key) {
                        setDropTargetFieldKey(null);
                      }
                    }}
                    onDrop={() => handleFieldDrop(field.key)}
                    onPatch={(updater) => onSchemaFieldPatch(field.key, updater)}
                    onTypeChange={(nextType) =>
                      onSchemaFieldPatch(field.key, (current) =>
                        makeSchemaField(nextType, effectiveSchemaFields.filter((item) => item.key !== field.key), {
                          ...current,
                          key: current.key,
                          label: current.label,
                          description: current.description,
                          required: current.required,
                          unique: current.unique,
                          default: current.default,
                        }),
                      )
                    }
                    onRemove={() => onRemoveSchemaField(field.key)}
                  />
                ))}
              </Stack>
            )}
          </WorkspaceSection>
        </WorkspacePanel>
      </WorkspaceMain>
    </WorkspacePage>
  );
}
