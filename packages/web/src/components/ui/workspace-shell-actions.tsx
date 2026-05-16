import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { ActionIcon, Box, Button, Group, Stack, Text, Title, Tooltip, UnstyledButton } from '@mantine/core';
import type { ButtonProps } from '@mantine/core';
import {
  WORKSPACE_HEADER_ACTION_SIZE,
  WORKSPACE_SHELL_CONTROL_BG,
  WORKSPACE_SHELL_CONTROL_BORDER,
  WORKSPACE_SHELL_DESCRIPTION_TEXT,
  WORKSPACE_SHELL_MUTED_TEXT,
  WORKSPACE_SHELL_TEXT,
} from './workspace-primitives.shared';

export function WorkspacePage({ children }: { children: ReactNode }) {
  return <Stack gap="lg">{children}</Stack>;
}

export function WorkspaceActionGroup({ children }: { children: ReactNode }) {
  return <Group gap="xs" wrap="wrap" style={{ minWidth: 0 }}>{children}</Group>;
}

export function WorkspaceIconTooltip({
  label,
  children,
  position = 'right',
}: {
  label: ReactNode;
  children: ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <Tooltip
      label={label}
      withArrow
      position={position}
      openDelay={100}
      offset={10}
      arrowSize={7}
      radius="md"
      color="dark"
    >
      {children}
    </Tooltip>
  );
}

type WorkspaceHeaderActionIconProps = {
  ariaLabel: string;
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'subtle' | 'filled' | 'light';
};

export const WorkspaceHeaderActionIcon = forwardRef<HTMLButtonElement, WorkspaceHeaderActionIconProps>(({
  children,
  ariaLabel,
  onClick,
  variant = 'default',
}, ref) => (
  <WorkspaceIconTooltip label={ariaLabel} position="top">
    <ActionIcon
      ref={ref}
      variant={variant}
      size={WORKSPACE_HEADER_ACTION_SIZE}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </ActionIcon>
  </WorkspaceIconTooltip>
));

WorkspaceHeaderActionIcon.displayName = 'WorkspaceHeaderActionIcon';

type WorkspaceToolbarButtonProps = ComponentPropsWithoutRef<'button'> & ButtonProps;

export const WorkspaceToolbarButton = forwardRef<HTMLButtonElement, WorkspaceToolbarButtonProps>((props, ref) => (
  <Button
    ref={ref}
    variant="default"
    styles={{
      root: {
        backgroundColor: WORKSPACE_SHELL_CONTROL_BG,
        borderColor: WORKSPACE_SHELL_CONTROL_BORDER,
        color: WORKSPACE_SHELL_TEXT,
      },
      section: {
        color: WORKSPACE_SHELL_MUTED_TEXT,
      },
    }}
    {...props}
  />
));

WorkspaceToolbarButton.displayName = 'WorkspaceToolbarButton';

export function WorkspaceRecordLink({
  children,
  onClick,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      data-testid={testId}
      style={{ width: '100%', textAlign: 'left' }}
    >
      <Text
        component="span"
        fw={500}
        span
        style={{
          display: 'inline-block',
          color: 'var(--ori-table-link)',
          transition: 'color 120ms ease',
        }}
      >
        {children}
      </Text>
    </UnstyledButton>
  );
}

export function WorkspaceToolbar({
  actions,
  controls,
}: {
  actions?: ReactNode;
  controls?: ReactNode;
}) {
  if (!controls && !actions) return null;

  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" style={{ rowGap: 'var(--mantine-spacing-xs)' }}>
      {controls ? <Group gap="xs" wrap="wrap" style={{ minWidth: 0, flex: 1 }}>{controls}</Group> : <div />}
      {actions ? <WorkspaceActionGroup>{actions}</WorkspaceActionGroup> : null}
    </Group>
  );
}

export function WorkspaceHeader({
  actions,
  actionsInsetRight,
  contentInsetLeft,
  description,
  eyebrow,
  meta,
  title,
}: {
  actions?: ReactNode;
  actionsInsetRight?: React.CSSProperties['paddingRight'];
  contentInsetLeft?: React.CSSProperties['paddingLeft'];
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" style={{ rowGap: 'var(--mantine-spacing-xs)' }}>
      <Stack gap={2} style={{ minWidth: 0, flex: 1, paddingLeft: contentInsetLeft }}>
        {eyebrow ? (
          <Text size="sm" style={{ color: WORKSPACE_SHELL_MUTED_TEXT }}>
            {eyebrow}
          </Text>
        ) : null}
        <Title order={3}>{title}</Title>
        {description ? (
          <Text size="sm" style={{ color: WORKSPACE_SHELL_DESCRIPTION_TEXT }}>
            {description}
          </Text>
        ) : null}
        {meta}
      </Stack>
      {actions ? <Box style={{ paddingRight: actionsInsetRight }}><WorkspaceActionGroup>{actions}</WorkspaceActionGroup></Box> : null}
    </Group>
  );
}
