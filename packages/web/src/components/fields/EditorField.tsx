import { Alert } from '@mantine/core';
import type { SchemaField } from '@ori/shared';
import { getUnknownFieldDisplay, resolveFieldLabel, type FieldRendererContext } from './contracts';
import { fieldRegistry } from './registry';
import { WorkspaceFieldShell, WorkspaceToggleRow } from '../ui/WorkspacePrimitives';

interface EditorFieldProps {
  field: SchemaField;
  value: unknown;
  error?: string | null;
  disabled?: boolean;
  changed?: boolean;
  onChange: (value: unknown) => void;
  context: FieldRendererContext;
}

export function EditorField({ field, value, error = null, disabled = false, changed = false, onChange, context }: EditorFieldProps) {
  const { component: Renderer, isFallback, presentation } = fieldRegistry.resolve(field.type);
  const unknown = isFallback ? getUnknownFieldDisplay(field.type) : null;
  const descriptionLines = [field.description, field.options?.helpText]
    .map((line) => line?.trim())
    .filter((line, index, lines): line is string => Boolean(line) && lines.indexOf(line) === index);
  const description = descriptionLines.join(' ') || undefined;
  const label = resolveFieldLabel(field);

  if (presentation === 'toggle-row' && !unknown) {
    return (
      <WorkspaceToggleRow
        label={label}
        description={description}
        required={Boolean(field.required)}
        changed={changed}
        status={value ? 'Enabled' : 'Disabled'}
        error={error}
        control={<Renderer field={field} value={value} error={error} disabled={disabled} onChange={onChange} context={context} />}
      />
    );
  }

  return (
    <WorkspaceFieldShell
      label={label}
      description={description}
      required={Boolean(field.required)}
      changed={changed}
    >
      {unknown ? <Alert color="yellow" title={unknown.badge}>{unknown.message}</Alert> : null}
      <Renderer field={field} value={value} error={error} disabled={disabled} onChange={onChange} context={context} />
    </WorkspaceFieldShell>
  );
}
