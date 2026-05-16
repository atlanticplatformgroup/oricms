import { Autocomplete, MultiSelect, Select, TagsInput } from '@mantine/core';
import type { FieldRendererProps } from '../contracts';

export function EnumField({ field, value, error, disabled, onChange, context }: FieldRendererProps) {
  const choices = [
    ...((field.enumValues ?? []).map((choice) => ({ value: choice.value, label: choice.label ?? choice.value }))),
    ...((field.options?.choices ?? []).map((choice) => ({ value: choice.value, label: choice.label ?? choice.value }))),
    ...((context.customFieldChoices?.[field.key] ?? []).map((choice) => ({ value: choice, label: choice }))),
  ].filter((choice, index, list) => list.findIndex((item) => item.value === choice.value) === index);

  const allowCustom = Boolean(field.options?.allowCustomValue);
  const multiple = Boolean(field.multiple || field.options?.multiple);
  const label = field.label || field.key;

  if (multiple) {
    if (allowCustom) {
      return (
        <TagsInput
          aria-label={label}
          data={choices.map((choice) => choice.value)}
          value={Array.isArray(value) ? value.map(String) : []}
          error={error}
          disabled={disabled}
          onChange={(nextValue) => {
            onChange(nextValue);
            context.onCustomFieldChoice?.(field.key, nextValue);
          }}
        />
      );
    }

    return <MultiSelect aria-label={label} data={choices} value={Array.isArray(value) ? value.map(String) : []} error={error} disabled={disabled} onChange={onChange} />;
  }

  if (allowCustom) {
    return (
      <Autocomplete
        aria-label={label}
        data={choices.map((choice) => choice.value)}
        value={typeof value === 'string' ? value : ''}
        error={error}
        disabled={disabled}
        onChange={(nextValue) => {
          onChange(nextValue);
          const trimmed = nextValue.trim();
          if (!trimmed) return;
          if (choices.some((choice) => choice.value === trimmed)) return;
          context.onCustomFieldChoice?.(field.key, [...(context.customFieldChoices?.[field.key] ?? []), trimmed]);
        }}
      />
    );
  }

  return <Select aria-label={label} data={choices} value={typeof value === 'string' ? value : null} error={error} disabled={disabled} onChange={(nextValue) => onChange(nextValue || '')} clearable />;
}
