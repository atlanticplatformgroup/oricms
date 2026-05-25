import type { DragEventHandler, ReactNode } from 'react';
import { ActionIcon, Alert, Badge, Box, Button, Center, Divider, Loader, ScrollArea, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { GripVertical } from 'lucide-react';
import { WORKSPACE_SHELL_BORDER_COLOR, WORKSPACE_SHELL_TEXT } from './workspace-primitives.shared';
import { WorkspaceActionGroup } from './WorkspaceShellPrimitives';
import { WorkspaceInset } from './WorkspaceFormPrimitives';

export {
  workspaceShellChromeStyles,
  WORKSPACE_HEADER_ACTIONS_RAIL_INSET,
  WORKSPACE_STATUS_COLUMN_WIDTH,
  WORKSPACE_TABLE_CONTENT_RAIL_INSET,
  WORKSPACE_TIMESTAMP_COLUMN_WIDTH,
} from './workspace-primitives.shared';
export {
  WorkspaceActionGroup,
  WorkspaceHeader,
  WorkspaceHeaderActionIcon,
  WorkspaceIconTooltip,
  WorkspaceMobileSectionButton,
  WorkspacePage,
  WorkspacePrimaryRailButton,
  WorkspaceRecordLink,
  WorkspaceSidebarBoundaryToggle,
  WorkspaceSidebarGroupLabel,
  WorkspaceSidebarNavItem,
  WorkspaceSidebarSection,
  WorkspaceSidebarToggle,
  WorkspaceSortableHeader,
  WorkspaceToolbar,
  WorkspaceToolbarButton,
} from './WorkspaceShellPrimitives';
export {
  WorkspaceComplexFieldSurface,
  WorkspaceContentRail,
  WorkspaceEditorFieldGrid,
  WorkspaceFieldGrid,
  WorkspaceFieldPreview,
  WorkspaceFieldShell,
  WorkspaceFormSection,
  WorkspaceFormSurface,
  WorkspaceInset,
  WorkspaceIntro,
  WorkspaceListSurface,
  WorkspaceMain,
  WorkspacePanel,
  WorkspaceSplitMain,
  WorkspaceTableToolbarInset,
  WorkspaceToggleRow,
} from './WorkspaceFormPrimitives';

export function WorkspaceMobileRecordList({ children }: { children: ReactNode }) {
  return <Stack gap={0}>{children}</Stack>;
}

export function WorkspaceMobileRecordItem({
  title,
  summary,
  tertiary,
  meta,
  onClick,
  testId,
}: {
  title: ReactNode;
  summary?: ReactNode;
  tertiary?: ReactNode;
  meta?: ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      data-testid={testId}
      style={{
        width: '100%',
        textAlign: 'left',
        paddingBlock: 'var(--mantine-spacing-md)',
        borderBottom: `1px solid ${WORKSPACE_SHELL_BORDER_COLOR}`,
        cursor: 'pointer',
      }}
    >
      <Stack gap={4}>
        <Text fw={600} style={{ color: WORKSPACE_SHELL_TEXT }} lineClamp={1}>
          {title}
        </Text>
        {summary ? (
          <Text size="sm" c="dimmed" lineClamp={2} style={{ lineHeight: 1.4 }}>
            {summary}
          </Text>
        ) : null}
        {meta ? <Box>{meta}</Box> : null}
        {tertiary ? (
          <Text size="xs" c="dimmed" ff="monospace" lineClamp={1}>
            {tertiary}
          </Text>
        ) : null}
      </Stack>
    </UnstyledButton>
  );
}

export function WorkspaceSection({
  title,
  description,
  badge,
  actions,
  dividerTop = false,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  dividerTop?: boolean;
  children: ReactNode;
}) {
  return (
    <Stack gap="sm">
      {dividerTop ? <Divider /> : null}
      <Stack gap={2}>
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Box>
            <Stack gap={2}>
              <Box>
                <Stack gap={2}>
                  <Box>
                    <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 'var(--mantine-spacing-xs)' }}>
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Box style={{ display: 'flex', gap: 'var(--mantine-spacing-xs)', flexWrap: 'wrap' }}>
                          <Text fw={600}>{title}</Text>
                          {badge}
                        </Box>
                        {description ? (
                          <Text size="sm" c="dimmed">
                            {description}
                          </Text>
                        ) : null}
                      </Box>
                      {actions ? <WorkspaceActionGroup>{actions}</WorkspaceActionGroup> : null}
                    </Box>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Stack>
      {children}
    </Stack>
  );
}

export function WorkspaceFooterBar({ children }: { children: ReactNode }) {
  return (
    <WorkspaceInset>
      <Stack gap="sm">{children}</Stack>
    </WorkspaceInset>
  );
}

export function WorkspaceMetricBadge({
  children,
  color = 'gray',
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: React.CSSProperties;
}) {
  const tone = (() => {
    switch (color) {
      case 'green':
        return { background: 'rgba(125, 184, 138, 0.14)', border: 'rgba(125, 184, 138, 0.22)' };
      case 'blue':
        return { background: 'rgba(138, 174, 212, 0.14)', border: 'rgba(138, 174, 212, 0.2)' };
      case 'yellow':
        return { background: 'rgba(212, 184, 106, 0.14)', border: 'rgba(212, 184, 106, 0.22)' };
      case 'orange':
        return { background: 'rgba(196, 139, 110, 0.14)', border: 'rgba(196, 139, 110, 0.22)' };
      case 'red':
        return { background: 'rgba(196, 112, 112, 0.14)', border: 'rgba(196, 112, 112, 0.22)' };
      case 'slate':
        return { background: 'rgba(74, 90, 114, 0.18)', border: 'rgba(98, 118, 148, 0.28)' };
      default:
        return { background: 'rgba(148, 160, 198, 0.14)', border: 'rgba(148, 160, 198, 0.2)' };
    }
  })();

  return (
    <Badge
      variant="transparent"
      color={color}
      style={{
        backgroundColor: tone.background,
        border: `1px solid ${tone.border}`,
        color: 'var(--ori-shell-text)',
        ...style,
      }}
    >
      {children}
    </Badge>
  );
}

export function WorkspaceLoadingState({ label = 'Loading…' }: { label?: ReactNode }) {
  return (
    <Center py="xl">
      <Stack gap="xs" align="center">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">{label}</Text>
      </Stack>
    </Center>
  );
}

export function WorkspaceErrorState({
  title,
  message,
  onRetry,
}: {
  title: ReactNode;
  message: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <Alert color="red" title={title}>
      <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <Text size="sm">{message}</Text>
        {onRetry ? (
          <Button size="xs" variant="default" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </Box>
    </Alert>
  );
}

export function WorkspaceEmptyState({
  title,
  message,
}: {
  title: ReactNode;
  message: ReactNode;
}) {
  return (
    <Alert color="gray" title={title}>
      <Text size="sm">{message}</Text>
    </Alert>
  );
}

export function WorkspaceTableContainer({ children }: { children: ReactNode }) {
  return (
    <ScrollArea type="hover">
      <div style={{ minWidth: 'fit-content', width: '100%' }}>{children}</div>
    </ScrollArea>
  );
}

export function WorkspaceOperationalTable({ children }: { children: ReactNode }) {
  return (
    <Table
      highlightOnHover
      withTableBorder
      verticalSpacing="sm"
      horizontalSpacing="md"
      style={{ tableLayout: 'fixed', width: '100%' }}
    >
      {children}
    </Table>
  );
}

export function WorkspaceDragHandle({
  label,
  draggable = false,
  onDragStart,
  onDragEnd,
}: {
  label: string;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLElement>;
  onDragEnd?: DragEventHandler<HTMLElement>;
}) {
  return (
    <ActionIcon
      component="div"
      role="button"
      tabIndex={0}
      variant="subtle"
      size="sm"
      aria-label={label}
      title={label}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ cursor: draggable ? 'grab' : 'default' }}
    >
      <GripVertical size={16} />
    </ActionIcon>
  );
}
