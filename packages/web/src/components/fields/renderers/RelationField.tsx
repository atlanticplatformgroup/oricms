import { Box, Button, Group, MultiSelect, Select, Stack, Text } from '@mantine/core';
import { getRefId, getRefIds } from '@ori/shared';
import { isMultiRelationField } from '../../../lib/entries/resolution';
import { toLabel } from '../../../lib/workspace/format';
import { resolveFieldLabel, type FieldRendererProps } from '../contracts';
import { WorkspaceComplexFieldSurface } from '../../ui/WorkspacePrimitives';

export function RelationField({ field, value, error, disabled, onChange, context }: FieldRendererProps) {
  const options = context.relationOptionsByField?.[field.key] ?? [];
  const isMultiple = isMultiRelationField(field);
  const selectedCount = isMultiple ? getRefIds(value).length : getRefId(value) ? 1 : 0;
  const label = resolveFieldLabel(field);
  const labelMap = context.relationLabelMapByField?.[field.key] ?? {};
  const selectedOptions = (isMultiple ? getRefIds(value) : getRefId(value) ? [getRefId(value)!] : []).map((selectedId) => ({
    value: selectedId,
    label: labelMap[selectedId] || selectedId,
  }));

  const control = isMultiple ? (
    <MultiSelect
      aria-label={label}
      data={options}
      value={getRefIds(value)}
      error={error}
      disabled={disabled}
      onChange={onChange}
    />
  ) : (
    <Select
      aria-label={label}
      data={options}
      value={getRefId(value) || null}
      error={error}
      disabled={disabled}
      clearable
      onChange={(nextValue) => onChange(nextValue || '')}
    />
  );

  return (
    <WorkspaceComplexFieldSurface>
      <Stack gap="md">
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            {selectedCount === 0 ? 'No linked entries selected' : selectedCount === 1 ? '1 linked entry' : `${selectedCount} linked entries`}
          </Text>
          <Text size="sm" c="dimmed">
            {typeof field.relation?.target === 'string' && field.relation.target
              ? `Linked to ${toLabel(field.relation.target)}`
              : 'Select existing entries from another collection.'}
          </Text>
        </Stack>
        {selectedOptions.length ? (
          <Stack gap="xs">
            {selectedOptions.map((option) => (
              <WorkspaceComplexFieldSurface key={option.value}>
                <Stack gap={2}>
                  <Text size="sm" fw={600}>{option.label}</Text>
                  <Text size="xs" c="dimmed">
                    {typeof field.relation?.target === 'string' && field.relation.target
                      ? toLabel(field.relation.target)
                      : 'Linked entry'}
                  </Text>
                </Stack>
              </WorkspaceComplexFieldSurface>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">No linked entries selected yet.</Text>
        )}
        <Group gap="sm" align="flex-start">
          <Button variant="default" disabled={disabled} onClick={() => context.onOpenRelationPicker?.(field.key)}>
            Browse entries
          </Button>
          <Box flex={1} miw={0}>{control}</Box>
        </Group>
      </Stack>
    </WorkspaceComplexFieldSurface>
  );
}
