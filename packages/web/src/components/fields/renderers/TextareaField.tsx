import { memo } from 'react';
import { Textarea } from '@mantine/core';
import type { FieldRendererProps } from '../contracts';

export const TextareaField = memo(function TextareaField({ field, value, error, disabled, onChange }: FieldRendererProps) {
  return (
    <Textarea
      aria-label={field.label || field.key}
      autosize
      minRows={field.type === 'markdown' ? 6 : 4}
      value={typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2)}
      error={error}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
});
