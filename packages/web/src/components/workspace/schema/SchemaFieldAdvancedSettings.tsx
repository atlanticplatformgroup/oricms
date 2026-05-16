import { Button, Group, MultiSelect, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import type { RelationType, SchemaField } from '@ori/shared';
import { WorkspaceFieldGrid } from '../../ui/WorkspacePrimitives';

interface SchemaFieldAdvancedSettingsProps {
  field: SchemaField;
  onPatch: (updater: (field: SchemaField) => SchemaField) => void;
  componentSchemaOptions: Array<{ value: string; label: string }>;
  collectionOptions: Array<{ value: string; label: string }>;
  uidSourceOptions: Array<{ value: string; label: string }>;
  disabled?: boolean;
}

function patchOption(field: SchemaField, key: keyof NonNullable<SchemaField['options']>, value: unknown): SchemaField {
  const nextOptions = { ...(field.options || {}), [key]: value };
  return { ...field, options: nextOptions };
}

function renderDefaultInput(
  field: SchemaField,
  onPatch: (updater: (field: SchemaField) => SchemaField) => void,
  disabled: boolean,
) {
  if (field.type === 'boolean') {
    return (
      <Switch
        label="Default value"
        checked={Boolean(field.default)}
        disabled={disabled}
        onChange={(event) => onPatch((current) => ({ ...current, default: event.currentTarget.checked }))}
      />
    );
  }

  if (field.type === 'number') {
    return (
      <TextInput
        label="Default value"
        value={field.default === undefined ? '' : String(field.default)}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.currentTarget.value.trim();
          onPatch((current) => ({ ...current, default: raw === '' ? undefined : Number(raw) }));
        }}
      />
    );
  }

  if (['date', 'datetime', 'string', 'text', 'textarea', 'markdown', 'uid', 'email', 'url', 'password', 'color'].includes(field.type)) {
    return (
      <TextInput
        label="Default value"
        value={field.default === undefined ? '' : String(field.default)}
        disabled={disabled}
        onChange={(event) => onPatch((current) => ({ ...current, default: event.currentTarget.value || undefined }))}
      />
    );
  }

  return null;
}

export function SchemaFieldAdvancedSettings({
  field,
  onPatch,
  componentSchemaOptions,
  collectionOptions,
  uidSourceOptions,
  disabled = false,
}: SchemaFieldAdvancedSettingsProps) {
  const choiceItems = field.enumValues || [];
  const canBeUnique = ['string', 'uid', 'email', 'url', 'number'].includes(field.type);
  const showDefaultInput = ['string', 'text', 'textarea', 'markdown', 'uid', 'email', 'url', 'password', 'color', 'number', 'boolean', 'date', 'datetime'].includes(field.type);

  return (
    <Stack gap="sm">
      <WorkspaceFieldGrid>
        {showDefaultInput ? renderDefaultInput(field, onPatch, disabled) : <div />}
        {canBeUnique ? (
          <Switch
            label="Unique"
            checked={Boolean(field.unique)}
            disabled={disabled}
            onChange={(event) => onPatch((current) => ({ ...current, unique: event.currentTarget.checked || undefined }))}
          />
        ) : (
          <div />
        )}
      </WorkspaceFieldGrid>

      {field.type === 'uid' ? (
        <Select
          label="Source field"
          data={uidSourceOptions}
          value={field.uidSource || null}
          disabled={disabled}
          onChange={(nextValue) => onPatch((current) => ({ ...current, uidSource: nextValue || '' }))}
        />
      ) : null}

      {field.type === 'enum' || field.type === 'select' ? (
        <Stack gap="sm">
          <WorkspaceFieldGrid>
            <Switch
              label="Allow custom values"
              checked={Boolean(field.options?.allowCustomValue)}
              disabled={disabled}
              onChange={(event) => onPatch((current) => patchOption(current, 'allowCustomValue', event.currentTarget.checked || undefined))}
            />
            <Switch
              label="Allow multiple values"
              checked={Boolean(field.options?.multiple)}
              disabled={disabled}
              onChange={(event) => onPatch((current) => patchOption(current, 'multiple', event.currentTarget.checked || undefined))}
            />
          </WorkspaceFieldGrid>
          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500}>Choices</Text>
              <Button
                variant="default"
                size="xs"
                disabled={disabled}
                onClick={() =>
                  onPatch((current) => ({
                    ...current,
                    enumValues: [...(current.enumValues || []), { value: `option_${(current.enumValues?.length || 0) + 1}`, label: `Option ${(current.enumValues?.length || 0) + 1}` }],
                  }))
                }
              >
                Add choice
              </Button>
            </Group>
            {choiceItems.length === 0 ? (
              <Text size="xs" c="dimmed">Add at least one choice for this field.</Text>
            ) : (
              choiceItems.map((choice, index) => (
                <WorkspaceFieldGrid key={`${choice.value}-${index}`} cols={{ base: 1, sm: 2, lg: 3 }}>
                  <TextInput
                    label={index === 0 ? 'Value' : undefined}
                    value={choice.value}
                    disabled={disabled}
                    onChange={(event) =>
                      onPatch((current) => ({
                        ...current,
                        enumValues: (current.enumValues || []).map((item, itemIndex) =>
                          itemIndex === index ? { ...item, value: event.currentTarget.value } : item,
                        ),
                      }))
                    }
                  />
                  <TextInput
                    label={index === 0 ? 'Label' : undefined}
                    value={choice.label}
                    disabled={disabled}
                    onChange={(event) =>
                      onPatch((current) => ({
                        ...current,
                        enumValues: (current.enumValues || []).map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: event.currentTarget.value } : item,
                        ),
                      }))
                    }
                  />
                  <Button
                    variant="subtle"
                    color="red"
                    size="compact-sm"
                    disabled={disabled}
                    onClick={() =>
                      onPatch((current) => ({
                        ...current,
                        enumValues: (current.enumValues || []).filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                  >
                    Remove
                  </Button>
                </WorkspaceFieldGrid>
              ))
            )}
          </Stack>
        </Stack>
      ) : null}

      {field.type === 'relation' ? (
        <WorkspaceFieldGrid>
          <Select
            label="Target collection"
            data={collectionOptions}
            value={field.relation?.target || null}
            disabled={disabled}
            onChange={(nextValue) =>
              onPatch((current) => ({
                ...current,
                relation: { ...(current.relation || { type: 'manyToOne' }), target: nextValue || '' },
              }))
            }
          />
          <Select
            label="Relation type"
            data={[
              { value: 'oneToOne', label: 'One to one' },
              { value: 'oneToMany', label: 'One to many' },
              { value: 'manyToOne', label: 'Many to one' },
              { value: 'manyToMany', label: 'Many to many' },
            ]}
            value={field.relation?.type || 'manyToOne'}
            disabled={disabled}
            onChange={(nextValue) =>
              onPatch((current) => ({
                ...current,
                relation: { ...(current.relation || { target: '' }), type: (nextValue as RelationType) || 'manyToOne' },
              }))
            }
          />
        </WorkspaceFieldGrid>
      ) : null}

      {field.type === 'reference' ? (
        <WorkspaceFieldGrid>
          <Select
            label="Target collection"
            data={collectionOptions}
            value={field.options?.referenceCollection || null}
            disabled={disabled}
            onChange={(nextValue) => onPatch((current) => patchOption(current, 'referenceCollection', nextValue || ''))}
          />
          <Select
            label="Reference kind"
            data={[
              { value: 'single', label: 'Single entry' },
              { value: 'collection', label: 'Collection' },
            ]}
            value={field.options?.referenceKind || 'single'}
            disabled={disabled}
            onChange={(nextValue) => onPatch((current) => patchOption(current, 'referenceKind', (nextValue as 'single' | 'collection') || 'single'))}
          />
        </WorkspaceFieldGrid>
      ) : null}

      {field.type === 'component' ? (
        <WorkspaceFieldGrid>
          <Select
            label="Component"
            data={componentSchemaOptions}
            value={field.component || null}
            disabled={disabled}
            onChange={(nextValue) => onPatch((current) => ({ ...current, component: nextValue || '' }))}
          />
          <Switch
            label="Repeatable"
            checked={Boolean(field.repeatable)}
            disabled={disabled}
            onChange={(event) => onPatch((current) => ({ ...current, repeatable: event.currentTarget.checked }))}
          />
        </WorkspaceFieldGrid>
      ) : null}

      {field.type === 'blocks' ? (
        <MultiSelect
          label="Allowed components"
          data={componentSchemaOptions}
          value={field.options?.allowedComponents || []}
          disabled={disabled}
          onChange={(nextValue) => onPatch((current) => patchOption(current, 'allowedComponents', nextValue))}
        />
      ) : null}
    </Stack>
  );
}
