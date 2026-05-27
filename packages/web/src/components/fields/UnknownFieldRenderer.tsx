import { Badge, Paper, Text, Textarea } from '@mantine/core';
import type { FieldRendererProps } from './contracts';

export function UnknownFieldRenderer({ field, value, error, disabled, onChange }: FieldRendererProps) {
  const serialized = typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2);
  return (
    <Paper withBorder p="sm">
      <Badge color="yellow" variant="light">Unknown field type</Badge>
      <Text size="sm" c="dimmed" mt="xs" mb="xs">
        OriCMS does not have a registered renderer for "{field.type}". Falling back to structured editing.
      </Text>
      <Textarea autosize minRows={4} value={serialized} error={error} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)} />
    </Paper>
  );
}
