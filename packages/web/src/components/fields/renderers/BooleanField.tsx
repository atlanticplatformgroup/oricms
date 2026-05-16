import { Switch } from '@mantine/core';
import type { FieldRendererProps } from '../contracts';

export function BooleanField({ field, value, disabled, onChange }: FieldRendererProps) {
  const checked = Boolean(value);

  return (
    <Switch
      aria-label={field.label || field.key}
      checked={checked}
      disabled={disabled}
      styles={{
        root: { display: 'flex', justifyContent: 'flex-end' },
        track: { cursor: disabled ? 'not-allowed' : 'pointer' },
      }}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}
