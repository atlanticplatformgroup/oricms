import type { ReactNode } from 'react';
import { ActionIcon, alpha, Box, Flex, Group, NavLink, ScrollArea, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { ArrowsUpDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { SECONDARY_TOGGLE_WIDTH } from '../../lib/workspace/constants';
import {
  WORKSPACE_SHELL_ACTIVE_BG,
  WORKSPACE_SHELL_ACTIVE_HOVER,
  WORKSPACE_SHELL_ACTIVE_TEXT,
  WORKSPACE_SHELL_BORDER_COLOR,
  WORKSPACE_SHELL_CONTROL_BG,
  WORKSPACE_SHELL_CONTROL_BORDER,
  WORKSPACE_SHELL_CONTROL_HOVER,
  WORKSPACE_SHELL_MUTED_TEXT,
  WORKSPACE_SHELL_TEXT,
  WORKSPACE_SHELL_TOP_SURFACE_BG,
  WORKSPACE_SIDEBAR_CONTENT_INSET,
  WORKSPACE_SIDEBAR_ROW_RADIUS,
  WORKSPACE_SIDEBAR_TOGGLE_SLOT,
  WORKSPACE_TRANSITION_BG,
  WORKSPACE_TRANSITION_COLOR,
  WORKSPACE_TRANSITION_SHADOW,
} from './workspace-primitives.shared';
import { WorkspaceActionGroup, WorkspaceIconTooltip } from './workspace-shell-actions';

export function WorkspaceSidebarNavItem({
  active,
  ariaLabel,
  description,
  domId,
  itemId,
  label,
  onClick,
  section,
  testId,
}: {
  active: boolean;
  ariaLabel: string;
  description?: ReactNode;
  domId: string;
  itemId: string;
  label: ReactNode;
  onClick: () => void;
  section: string;
  testId?: string;
}) {
  return (
    <NavLink
      id={domId}
      aria-label={ariaLabel}
      data-ori-sidebar-item={itemId}
      data-ori-sidebar-section={section}
      label={label}
      description={description}
      active={active}
      data-testid={testId}
      onClick={onClick}
      styles={{
        root: {
          borderRadius: WORKSPACE_SIDEBAR_ROW_RADIUS,
          paddingBlock: description ? '9px' : '11px',
          paddingInline: '12px',
          minHeight: description ? 58 : 44,
          transition: `${WORKSPACE_TRANSITION_BG}, ${WORKSPACE_TRANSITION_COLOR}, ${WORKSPACE_TRANSITION_SHADOW}`,
          color: WORKSPACE_SHELL_TEXT,
          boxShadow: 'inset 0 0 0 1px transparent',
          '&:hover': {
            backgroundColor: WORKSPACE_SHELL_CONTROL_HOVER,
          },
          '&[dataActive="true"]': {
            backgroundColor: WORKSPACE_SHELL_ACTIVE_BG,
            boxShadow: 'inset 2px 0 0 var(--ori-selection-border)',
          },
          '&[dataActive="true"]:hover': {
            backgroundColor: WORKSPACE_SHELL_ACTIVE_HOVER,
          },
        },
        body: {
          gap: '3px',
        },
        label: {
          fontWeight: active ? 600 : 500,
          color: active ? WORKSPACE_SHELL_ACTIVE_TEXT : WORKSPACE_SHELL_TEXT,
        },
        description: {
          color: active ? WORKSPACE_SHELL_ACTIVE_TEXT : WORKSPACE_SHELL_MUTED_TEXT,
          marginTop: '1px',
          opacity: active ? 0.78 : 1,
        },
      }}
    />
  );
}

export function WorkspaceSidebarGroupLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      size="xs"
      fw={700}
      tt="uppercase"
      c="dimmed"
      px={12}
      pt="sm"
      pb={4}
      lts="0.04em"
    >
      {children}
    </Text>
  );
}

export function WorkspacePrimaryRailButton({
  active,
  children,
  label,
  onClick,
  testId,
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <WorkspaceIconTooltip label={label}>
      <ActionIcon
        size="lg"
        aria-label={label}
        data-testid={testId}
        onClick={onClick}
        variant="default"
        styles={{
          root: {
            backgroundColor: active ? WORKSPACE_SHELL_ACTIVE_BG : 'transparent',
            borderColor: active ? alpha('var(--ori-shell-active-text)', 0.32) : 'transparent',
            color: active ? WORKSPACE_SHELL_ACTIVE_TEXT : WORKSPACE_SHELL_MUTED_TEXT,
            boxShadow: active ? `inset 0 0 0 1px ${alpha('var(--ori-shell-active-text)', 0.32)}` : 'none',
            '&:hover': {
              backgroundColor: active ? WORKSPACE_SHELL_ACTIVE_HOVER : WORKSPACE_SHELL_CONTROL_HOVER,
            },
          },
        }}
      >
        {children}
      </ActionIcon>
    </WorkspaceIconTooltip>
  );
}

export function WorkspaceMobileSectionButton({
  active,
  children,
  label,
  onClick,
  testId,
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <UnstyledButton
      aria-label={label}
      data-testid={testId}
      onClick={onClick}
      w="100%"
      ta="left"
      p="xs"
      style={{
        borderRadius: 'var(--mantine-radius-xl)',
        border: `1px solid ${active ? WORKSPACE_SHELL_ACTIVE_HOVER : WORKSPACE_SHELL_CONTROL_BORDER}`,
        backgroundColor: active ? WORKSPACE_SHELL_ACTIVE_BG : WORKSPACE_SHELL_CONTROL_BG,
        color: active ? WORKSPACE_SHELL_ACTIVE_TEXT : WORKSPACE_SHELL_TEXT,
      }}
    >
      <Group gap="sm" wrap="nowrap">
        <Box
          w={34}
          h={34}
          display="flex"
          style={{
            borderRadius: 'var(--mantine-radius-lg)',
            backgroundColor: active ? WORKSPACE_SHELL_ACTIVE_HOVER : 'transparent',
            color: active ? WORKSPACE_SHELL_ACTIVE_TEXT : WORKSPACE_SHELL_MUTED_TEXT,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </Box>
        <Text fw={active ? 600 : 500} size="sm" truncate>{label}</Text>
      </Group>
    </UnstyledButton>
  );
}

export function WorkspaceSortableHeader({
  active,
  direction,
  label,
  onToggle,
}: {
  active: boolean;
  direction?: 'asc' | 'desc';
  label: ReactNode;
  onToggle: () => void;
}) {
  const nextDirectionLabel = active && direction === 'asc' ? 'descending' : 'ascending';
  const icon = !active
    ? <ArrowsUpDownIcon width={14} height={14} />
    : direction === 'asc'
      ? <ChevronRightIcon width={14} height={14} style={{ transform: 'rotate(-90deg)' }} />
      : <ChevronRightIcon width={14} height={14} style={{ transform: 'rotate(90deg)' }} />;

  return (
    <UnstyledButton
      onClick={onToggle}
      aria-label={`Sort by ${typeof label === 'string' ? label : 'column'} ${nextDirectionLabel}`}
      w="100%"
    >
      <Group justify="space-between" gap="xs" wrap="nowrap" w="100%">
        <Text
          component="span"
          fw={active ? 600 : 500}
          size="sm"
          style={{ color: active ? 'var(--ori-table-text)' : 'var(--ori-table-header-text)' }}
        >
          {label}
        </Text>
        <Text
          component="span"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            flexShrink: 0,
            color: active ? 'var(--ori-table-link)' : 'var(--ori-table-header-text)',
            opacity: active ? 1 : 0.72,
          }}
        >
          {icon}
        </Text>
      </Group>
    </UnstyledButton>
  );
}

export function WorkspaceSidebarSection({
  action,
  children,
  collapsed = false,
  control,
  onToggleCollapsed,
  scrollHeight = 'calc(100vh - 188px)',
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  collapsed?: boolean;
  control?: ReactNode;
  onToggleCollapsed?: () => void;
  scrollHeight?: string | number;
  title: ReactNode;
}) {
  if (collapsed) return null;

  return (
    <Stack gap={0} py={0} flex={1} miw={0}>
      <Box
        px={WORKSPACE_SIDEBAR_CONTENT_INSET}
        pt="md"
        pb="sm"
        style={{
          backgroundColor: WORKSPACE_SHELL_TOP_SURFACE_BG,
          borderBottom: `1px solid ${WORKSPACE_SHELL_BORDER_COLOR}`,
        }}
      >
        <Group justify="space-between" align="center" wrap="nowrap" mih={40}>
          <Title order={5}>{title}</Title>
          <Group gap="xs" wrap="nowrap" flex="0 0 auto">
            {action ? <WorkspaceActionGroup>{action}</WorkspaceActionGroup> : null}
            {onToggleCollapsed ? (
              <Flex
                w={SECONDARY_TOGGLE_WIDTH}
                h={WORKSPACE_SIDEBAR_TOGGLE_SLOT}
                align="center"
                justify="flex-end"
                style={{ paddingRight: '2px' }}
              >
                <WorkspaceSidebarToggle collapsed={false} onClick={onToggleCollapsed} />
              </Flex>
            ) : null}
          </Group>
        </Group>
        {control ? <Box pt="sm">{control}</Box> : null}
      </Box>
      <ScrollArea h={scrollHeight} type="never">
        <Stack gap={4} px={WORKSPACE_SIDEBAR_CONTENT_INSET} pt="sm">
          {children}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

export function WorkspaceSidebarToggle({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  return (
    <WorkspaceIconTooltip label={label}>
      <ActionIcon
        variant="default"
        size="sm"
        radius="md"
        aria-label={label}
        onClick={onClick}
        styles={{
          root: {
            backgroundColor: WORKSPACE_SHELL_CONTROL_BG,
            borderColor: WORKSPACE_SHELL_CONTROL_BORDER,
            color: WORKSPACE_SHELL_MUTED_TEXT,
          },
        }}
      >
        {collapsed ? <ChevronRightIcon width={18} height={18} strokeWidth={2.25} /> : <ChevronLeftIcon width={18} height={18} strokeWidth={2.25} />}
      </ActionIcon>
    </WorkspaceIconTooltip>
  );
}

export function WorkspaceSidebarBoundaryToggle({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <Stack justify="flex-start" align="center" h="100%" w={SECONDARY_TOGGLE_WIDTH} pt="md">
      <Flex w={SECONDARY_TOGGLE_WIDTH} h={WORKSPACE_SIDEBAR_TOGGLE_SLOT} align="center" justify="center">
        <WorkspaceSidebarToggle collapsed={collapsed} onClick={onClick} />
      </Flex>
    </Stack>
  );
}
