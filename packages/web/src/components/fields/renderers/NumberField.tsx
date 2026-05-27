import { memo } from 'react';
import { NumberInput } from '@mantine/core';
import type { FieldRendererProps } from '../contracts';

export const NumberField = memo(function NumberField({ field, value, error, disabled, onChange }: FieldRendererProps) {
  return <NumberInput aria-label={field.label || field.key} value={typeof value === 'number' ? value : value == null ? undefined : Number(value)} error={error} disabled={disabled} onChange={(nextValue) => onChange(nextValue === '' ? null : nextValue)} />;
});
