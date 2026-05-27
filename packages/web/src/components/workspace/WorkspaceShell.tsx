import type { ReactNode } from 'react';
import type { SchemaField } from '@ori/shared';
import { ReadonlyFieldValue } from '../fields/ReadonlyFieldValue';
import { AppShellLayout } from './WorkspaceShellLayout';
import type { AppShellLayoutProps } from './WorkspaceShellLayout.types';

export type WorkspaceShellProps = Omit<AppShellLayoutProps, 'renderReadonlyFieldValue'>;

export function WorkspaceShell(props: WorkspaceShellProps) {
  const renderReadonlyFieldValue = (
    value: unknown,
    field?: SchemaField,
    context?: { relationLabels?: Record<string, string> },
  ): ReactNode => <ReadonlyFieldValue value={value} field={field} context={context} />;

  return <AppShellLayout {...props} renderReadonlyFieldValue={renderReadonlyFieldValue} />;
}
