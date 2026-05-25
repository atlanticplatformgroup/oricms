import { memo } from 'react';
import { Box, Divider, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { WorkspaceMobileSectionButton, WorkspacePrimaryRailButton, WorkspaceSidebarBoundaryToggle, WorkspaceSidebarGroupLabel, WorkspaceSidebarNavItem, WorkspaceSidebarSection, workspaceShellChromeStyles } from '../ui/WorkspacePrimitives';
import { PRIMARY_RAIL_WIDTH } from '../../lib/workspace/constants';
import type { SectionKey, SidebarOption } from '../../lib/workspace/types';
import { buildWorkspacePath } from '../../lib/workspace/routing';

function toDomSafeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function renderGroupedSecondaryRailItems(props: {
  activeProjectSlug: string | null;
  activeSchemaMode: 'types' | 'components';
  activeSection: SectionKey;
  activeSectionLabel: string;
  activeSecondaryId: string | null;
  currentBranchName: string;
  secondaryOptions: SidebarOption[];
  onNavigate: (to: string) => void;
}) {
  const handleSecondaryChange = (optionId: string) => {
    if (!props.activeProjectSlug) return;
    if (props.activeSection === 'collections') {
      props.onNavigate(buildWorkspacePath(props.activeProjectSlug, 'collections', optionId, { branchName: props.currentBranchName }));
      return;
    }
    if (props.activeSection === 'schemas') {
      props.onNavigate(buildWorkspacePath(props.activeProjectSlug, 'schemas', optionId, { schemaMode: props.activeSchemaMode, branchName: props.currentBranchName }));
      return;
    }
    props.onNavigate(buildWorkspacePath(props.activeProjectSlug, props.activeSection, optionId, { branchName: props.currentBranchName }));
  };

  if (props.activeSection !== 'collections') {
    return props.secondaryOptions.map((option) => (
      <WorkspaceSidebarNavItem
        key={option.id}
        domId={`workspace-secondary-${toDomSafeId(props.activeSection)}-${toDomSafeId(option.id)}`}
        itemId={option.id}
        ariaLabel={`${props.activeSectionLabel}: ${option.label}`}
        label={option.label}
        description={option.description}
        active={option.id === props.activeSecondaryId}
        testId={`secondary-${option.id}`}
        section={props.activeSection}
        onClick={() => handleSecondaryChange(option.id)}
      />
    ));
  }

  const groupedOptions = new Map<string, { label: string; order: number; items: ReactNode[] }>();
  const ungroupedItems: ReactNode[] = [];

  props.secondaryOptions.forEach((option) => {
    const item = (
      <WorkspaceSidebarNavItem
        key={option.id}
        domId={`workspace-secondary-${toDomSafeId(props.activeSection)}-${toDomSafeId(option.id)}`}
        itemId={option.id}
        ariaLabel={`${props.activeSectionLabel}: ${option.label}`}
        label={option.label}
        active={option.id === props.activeSecondaryId}
        testId={`secondary-${option.id}`}
        section={props.activeSection}
        onClick={() => handleSecondaryChange(option.id)}
      />
    );

    if (option.groupId && option.groupLabel) {
      const existing = groupedOptions.get(option.groupId);
      if (existing) {
        existing.items.push(item);
      } else {
        groupedOptions.set(option.groupId, {
          label: option.groupLabel,
          order: option.groupOrder ?? Number.MAX_SAFE_INTEGER,
          items: [item],
        });
      }
      return;
    }

    ungroupedItems.push(item);
  });

  const orderedGroups = [...groupedOptions.values()].sort(
    (left, right) => left.order - right.order || left.label.localeCompare(right.label),
  );

  return [
    ...ungroupedItems,
    ...orderedGroups.flatMap((group) => [
      <WorkspaceSidebarGroupLabel key={`group-${group.label}`}>{group.label}</WorkspaceSidebarGroupLabel>,
      ...group.items,
    ]),
  ];
}

type SectionOption = {
  icon: React.ComponentType<{ height?: number | string; width?: number | string }>;
  key: SectionKey;
  label: string;
};

export const WorkspacePrimaryRail = memo(function WorkspacePrimaryRail(props: {
  activeSection: SectionKey;
  availableSections: SectionOption[];
  onSectionChange: (section: SectionKey) => void;
}) {
  return (
    <Stack
      gap="xs"
      align="center"
      w={PRIMARY_RAIL_WIDTH}
      miw={PRIMARY_RAIL_WIDTH}
      h="100%"
      pt="md"
      pb="xs"
      px="xs"
      style={{
        backgroundColor: workspaceShellChromeStyles.primaryRailBackground,
        borderRight: `1px solid ${workspaceShellChromeStyles.borderColor}`,
      }}
    >
      {props.availableSections.map((section) => {
        const Icon = section.icon;
        return (
          <WorkspacePrimaryRailButton
            key={section.key}
            label={section.label}
            active={section.key === props.activeSection}
            testId={`section-${section.key}`}
            onClick={() => props.onSectionChange(section.key)}
          >
            <Icon width={20} height={20} />
          </WorkspacePrimaryRailButton>
        );
      })}
    </Stack>
  );
});

export const WorkspaceSecondaryRail = memo(function WorkspaceSecondaryRail(props: {
  activeProjectSlug: string | null;
  activeSchemaMode: 'types' | 'components';
  activeSection: SectionKey;
  activeSectionLabel: string;
  activeSecondaryId: string | null;
  currentBranchName: string;
  onCollapse?: () => void;
  onNavigate: (to: string) => void;
  secondaryOptions: SidebarOption[];
  sidebarAction?: ReactNode;
  sidebarControl?: ReactNode;
  showInlineSecondaryRail: boolean;
}) {
  const groupedSecondaryRailItems = renderGroupedSecondaryRailItems({
    activeProjectSlug: props.activeProjectSlug,
    activeSchemaMode: props.activeSchemaMode,
    activeSection: props.activeSection,
    activeSectionLabel: props.activeSectionLabel,
    activeSecondaryId: props.activeSecondaryId,
    currentBranchName: props.currentBranchName,
    secondaryOptions: props.secondaryOptions,
    onNavigate: props.onNavigate,
  });

  return (
    <WorkspaceSidebarSection
      title={props.activeSectionLabel}
      collapsed={false}
      onToggleCollapsed={props.onCollapse}
      action={props.sidebarAction}
      control={props.sidebarControl}
      scrollHeight={props.showInlineSecondaryRail ? 'calc(100vh - 188px)' : 'auto'}
    >
      {groupedSecondaryRailItems}
    </WorkspaceSidebarSection>
  );
});

export const WorkspaceDrawerNavigation = memo(function WorkspaceDrawerNavigation(props: {
  activeProjectSlug: string | null;
  activeSchemaMode: 'types' | 'components';
  activeSection: SectionKey;
  activeSectionLabel: string;
  activeSecondaryId: string | null;
  availableSections: SectionOption[];
  currentBranchName: string;
  hasSecondaryRail: boolean;
  onNavigate: (to: string) => void;
  onSectionChange: (section: SectionKey) => void;
  secondaryOptions: SidebarOption[];
  sidebarAction?: ReactNode;
  sidebarControl?: ReactNode;
}) {
  const groupedSecondaryRailItems = renderGroupedSecondaryRailItems({
    activeProjectSlug: props.activeProjectSlug,
    activeSchemaMode: props.activeSchemaMode,
    activeSection: props.activeSection,
    activeSectionLabel: props.activeSectionLabel,
    activeSecondaryId: props.activeSecondaryId,
    currentBranchName: props.currentBranchName,
    secondaryOptions: props.secondaryOptions,
    onNavigate: props.onNavigate,
  });

  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
      <SimpleGrid cols={2} spacing="xs" data-testid="workspace-section-grid">
        {props.availableSections.map((section) => {
          const Icon = section.icon;
          return (
            <WorkspaceMobileSectionButton
              key={section.key}
              label={section.label}
              active={section.key === props.activeSection}
              testId={`workspace-section-${section.key}`}
              onClick={() => props.onSectionChange(section.key)}
            >
              <Icon width={18} height={18} />
            </WorkspaceMobileSectionButton>
          );
        })}
      </SimpleGrid>
      {props.hasSecondaryRail ? (
        <Box>
          <Divider mb="md" color={workspaceShellChromeStyles.borderColor} />
          <Stack gap="sm">
            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
              <Text fw={600}>{props.activeSectionLabel}</Text>
              {props.sidebarAction ? (
                <Group gap="xs" wrap="wrap">
                  {props.sidebarAction}
                </Group>
              ) : null}
            </Group>
            {props.sidebarControl ? <Box>{props.sidebarControl}</Box> : null}
            <Stack gap={4}>
              {groupedSecondaryRailItems}
            </Stack>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
});

export const WorkspaceSecondaryRailBoundaryToggle = memo(function WorkspaceSecondaryRailBoundaryToggle(props: {
  onExpandInline?: () => void;
  onExpandDrawer?: () => void;
  secondaryRailCollapsed: boolean;
  showInlineSecondaryRail: boolean;
  showSecondaryRailTrigger: boolean;
}) {
  return (
    <>
      {props.showInlineSecondaryRail && props.secondaryRailCollapsed ? (
        props.onExpandInline ? <WorkspaceSidebarBoundaryToggle collapsed onClick={props.onExpandInline} /> : null
      ) : null}
      {props.showSecondaryRailTrigger ? (
        props.onExpandDrawer ? <WorkspaceSidebarBoundaryToggle collapsed onClick={props.onExpandDrawer} /> : null
      ) : null}
    </>
  );
});
