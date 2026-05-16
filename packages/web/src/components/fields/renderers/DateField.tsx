import dayjs from 'dayjs';
import { DateInput, DateTimePicker } from '@mantine/dates';
import type { FieldRendererProps } from '../contracts';

function parseFieldDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toDate() : null;
}

export function DateField({ field, value, error, disabled, onChange }: FieldRendererProps) {
  const commonProps = {
    'aria-label': field.label || field.key,
    value: parseFieldDate(value),
    error,
    disabled,
    clearable: true,
  } as const;

  if (field.type === 'datetime') {
    return (
      <DateTimePicker
        {...commonProps}
        valueFormat="MMM D, YYYY h:mm A"
        onChange={(nextValue) => onChange(nextValue ? dayjs(nextValue).format('YYYY-MM-DDTHH:mm') : '')}
      />
    );
  }

  return (
    <DateInput
      {...commonProps}
      valueFormat="MMM D, YYYY"
      onChange={(nextValue) => onChange(nextValue ? dayjs(nextValue).format('YYYY-MM-DD') : '')}
    />
  );
}
