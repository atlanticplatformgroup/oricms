import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActionIcon, Box, Collapse, Grid, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import {
  WORKSPACE_FORM_DESCRIPTION_COLOR,
  WORKSPACE_FORM_LABEL_COLOR,
  WORKSPACE_FORM_PREVIEW_BG,
  WORKSPACE_FORM_SECTION_BORDER,
  WORKSPACE_FORM_SURFACE_BG,
  WORKSPACE_SHELL_DESCRIPTION_TEXT,
} from './workspace-primitives.shared';
import { WorkspaceActionGroup } from './workspace-shell-actions';

export function WorkspaceFormSurface({
  children,
  maxWidth = 920,
}: {
  children: ReactNode;
  maxWidth?: number | string;
}) {
  return (
    <Stack gap="lg" maw={maxWidth} w="100%">
      {children}
    </Stack>
  );
}

export function WorkspaceFormSection({
  actions,
  badge,
  children,
  collapsible = false,
  defaultCollapsed = false,
  description,
  title,
}: {
  actions?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  description?: ReactNode;
  title?: ReactNode;
}) {
  const hasHeader = Boolean(title || description || badge || actions);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const canCollapse = hasHeader && collapsible;
  const sectionLabel = typeof title === 'string' ? title : 'section';

  if (!hasHeader) {
    return <Stack gap="lg">{children}</Stack>;
  }

  return (
    <Stack gap="md">
      <Box
        pb="xs"
        style={{
          borderBottom: `1px solid ${WORKSPACE_FORM_SECTION_BORDER}`,
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
          <Stack gap={2} miw={0} flex={1}>
            <Group gap="xs" wrap="wrap">
              {title ? <Text fw={600} style={{ color: WORKSPACE_FORM_LABEL_COLOR }}>{title}</Text> : null}
              {badge}
            </Group>
            {description ? (
              <Text size="sm" lh={1.5} style={{ color: WORKSPACE_FORM_DESCRIPTION_COLOR }}>
                {description}
              </Text>
            ) : null}
          </Stack>
          <Group gap="xs" wrap="nowrap">
            {actions ? <WorkspaceActionGroup>{actions}</WorkspaceActionGroup> : null}
            {canCollapse ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={collapsed ? `Expand ${sectionLabel}` : `Collapse ${sectionLabel}`}
                onClick={() => setCollapsed((current) => !current)}
              >
                {collapsed ? <ChevronRightIcon width={16} height={16} /> : <ChevronDownIcon width={16} height={16} />}
              </ActionIcon>
            ) : null}
          </Group>
        </Group>
      </Box>
      <Collapse in={!collapsed}>
        <Stack gap="lg" style={{ backgroundColor: WORKSPACE_FORM_SURFACE_BG }}>
          {children}
        </Stack>
      </Collapse>
    </Stack>
  );
}

export function WorkspaceIntro({
  actions,
  children,
  description,
  title,
}: {
  actions?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <Stack gap="sm">
      {title || description || actions ? (
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
          <Stack gap={2} miw={0} flex={1}>
            {title ? <Text fw={600}>{title}</Text> : null}
            {description ? (
              <Text size="sm" style={{ color: WORKSPACE_SHELL_DESCRIPTION_TEXT }}>
                {description}
              </Text>
            ) : null}
          </Stack>
          {actions ? <WorkspaceActionGroup>{actions}</WorkspaceActionGroup> : null}
        </Group>
      ) : null}
      {children}
    </Stack>
  );
}

export function WorkspaceMain({ children }: { children: ReactNode }) {
  return <Stack gap="md">{children}</Stack>;
}

export function WorkspaceSplitMain({
  primary,
  primarySpan = { base: 12, lg: 8 },
  secondary,
  secondarySpan = { base: 12, lg: 4 },
}: {
  primary: ReactNode;
  primarySpan?: Parameters<typeof Grid.Col>[0]['span'];
  secondary?: ReactNode;
  secondarySpan?: Parameters<typeof Grid.Col>[0]['span'];
}) {
  return (
    <Grid gutter="md" align="start">
      <Grid.Col span={primarySpan}>{primary}</Grid.Col>
      {secondary ? <Grid.Col span={secondarySpan}>{secondary}</Grid.Col> : null}
    </Grid>
  );
}

export function WorkspaceFieldGrid({
  children,
  cols = { base: 1, sm: 2 },
}: {
  children: ReactNode;
  cols?: { base: number; sm?: number; md?: number; lg?: number; xl?: number };
}) {
  return (
    <SimpleGrid cols={cols} spacing="sm" verticalSpacing="sm">
      {children}
    </SimpleGrid>
  );
}

export function WorkspaceEditorFieldGrid({
  items,
}: {
  items: Array<{ content: ReactNode; key: string; width: 'full' | 'half' }>;
}) {
  return (
    <Grid gutter="md" align="start">
      {items.map((item) => (
        <Grid.Col key={item.key} span={{ base: 12, md: item.width === 'half' ? 6 : 12 }}>
          {item.content}
        </Grid.Col>
      ))}
    </Grid>
  );
}

export function WorkspacePanel({ children }: { children: ReactNode }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">{children}</Stack>
    </Paper>
  );
}

export function WorkspaceListSurface({ children }: { children: ReactNode }) {
  return <Stack gap="sm">{children}</Stack>;
}

export function WorkspaceTableToolbarInset({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function WorkspaceContentRail({ children }: { children: ReactNode }) {
  return <Box px="md">{children}</Box>;
}

export function WorkspaceInset({ children }: { children: ReactNode }) {
  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      style={{
        backgroundColor: WORKSPACE_FORM_PREVIEW_BG,
        borderColor: WORKSPACE_FORM_SECTION_BORDER,
      }}
    >
      <Stack gap="sm">{children}</Stack>
    </Paper>
  );
}

export function WorkspaceFieldShell({
  changed = false,
  children,
  description,
  label,
  required = false,
}: {
  changed?: boolean;
  children: ReactNode;
  description?: ReactNode;
  label: ReactNode;
  required?: boolean;
}) {
  return (
    <Box
      data-ori-field-changed={changed ? 'true' : 'false'}
      ps="sm"
      style={{
        borderInlineStart: `2px solid ${changed ? 'var(--ori-form-field-edited)' : 'transparent'}`,
      }}
    >
      <Stack gap={8}>
        <Group gap="xs" wrap="wrap">
          {changed ? (
            <Box
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: '999px',
                backgroundColor: 'var(--ori-form-field-edited)',
                flexShrink: 0,
              }}
            />
          ) : null}
          <Text size="sm" fw={700} lts="0.005em" lh={1.35} style={{ color: WORKSPACE_FORM_LABEL_COLOR }}>
            {label}
          </Text>
          {required ? (
            <Text component="span" size="sm" fw={700} c="red">
              *
            </Text>
          ) : null}
        </Group>
        {description ? (
          <Text size="sm" lh={1.5} style={{ color: WORKSPACE_FORM_DESCRIPTION_COLOR }}>
            {description}
          </Text>
        ) : null}
        <Box>{children}</Box>
      </Stack>
    </Box>
  );
}

export function WorkspaceFieldPreview({
  children,
  label = 'Current value',
}: {
  children: ReactNode;
  label?: ReactNode;
}) {
  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      style={{
        backgroundColor: WORKSPACE_FORM_PREVIEW_BG,
        borderColor: WORKSPACE_FORM_SECTION_BORDER,
      }}
    >
      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        {children}
      </Stack>
    </Paper>
  );
}

export function WorkspaceComplexFieldSurface({ children }: { children: ReactNode }) {
  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      style={{
        backgroundColor: WORKSPACE_FORM_PREVIEW_BG,
        borderColor: 'var(--ori-form-input-border)',
      }}
    >
      {children}
    </Paper>
  );
}

export function WorkspaceToggleRow({
  changed = false,
  control,
  description,
  error,
  label,
  required = false,
  status,
}: {
  changed?: boolean;
  control: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  label: ReactNode;
  required?: boolean;
  status?: ReactNode;
}) {
  return (
    <Box
      data-ori-field-changed={changed ? 'true' : 'false'}
      ps="sm"
      style={{
        borderInlineStart: `2px solid ${changed ? 'var(--ori-form-field-edited)' : 'transparent'}`,
      }}
    >
      <Stack gap={6}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
          <Stack gap={2} miw={0} flex={1}>
            <Group gap="xs" wrap="wrap">
              {changed ? (
                <Box
                  aria-hidden="true"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '999px',
                    backgroundColor: 'var(--ori-form-field-edited)',
                    flexShrink: 0,
                  }}
                />
              ) : null}
              <Text fw={700} style={{ color: WORKSPACE_FORM_LABEL_COLOR }}>
                {label}
              </Text>
              {required ? (
                <Text component="span" size="sm" fw={700} c="red">
                  *
                </Text>
              ) : null}
            </Group>
            {description ? (
              <Text size="sm" lh={1.5} style={{ color: WORKSPACE_FORM_DESCRIPTION_COLOR }}>
                {description}
              </Text>
            ) : null}
            {status ? (
              <Text size="sm" c="dimmed">
                {status}
              </Text>
            ) : null}
          </Stack>
          <Box style={{ flexShrink: 0 }}>
            {control}
          </Box>
        </Group>
        {error ? (
          <Text size="xs" c="red">
            {error}
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}
