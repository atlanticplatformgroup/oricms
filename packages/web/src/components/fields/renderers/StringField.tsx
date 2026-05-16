import type { ChangeEvent } from 'react';
import { Button, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import type { FieldRendererProps } from '../contracts';

export function StringField({ field, value, error, disabled, onChange, context }: FieldRendererProps) {
  const identifierState = context.identifierStateByField?.[field.key];
  const sharedProps = {
    'aria-label': field.label || field.key,
    value: typeof value === 'string' ? value : value == null ? '' : String(value),
    error,
    disabled,
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value),
  };

  return (
    <Stack gap={4}>
      {field.type === 'password' ? (
        <PasswordInput {...sharedProps} />
      ) : (
        <TextInput
          {...sharedProps}
          type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'color' ? 'color' : 'text'}
        />
      )}
      {identifierState ? (
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            {identifierState.auto
              ? `Auto-generated${identifierState.sourceLabel ? ` from ${identifierState.sourceLabel}` : ''}`
              : 'Custom value'}
          </Text>
          {!identifierState.auto ? (
            <Button
              variant="subtle"
              size="compact-xs"
              px={0}
              disabled={disabled}
              onClick={() => context.onResetIdentifierToAuto?.(field.key)}
            >
              Reset to auto
            </Button>
          ) : null}
        </Group>
      ) : null}
    </Stack>
  );
}
