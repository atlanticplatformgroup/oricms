import { Badge, Drawer, Group, Text } from '@mantine/core';
import { workspaceShellChromeStyles } from '../ui/WorkspacePrimitives';
import { SECONDARY_RAIL_WIDTH } from '../../lib/workspace/constants';
import { WorkspaceDrawerNavigation, WorkspaceSecondaryRail } from './WorkspaceShellNavigation';
import type { AppShellLayoutProps } from './WorkspaceShellLayout.types';

export function WorkspaceShellDrawers(props: {
  layout: AppShellLayoutProps;
  hasSecondaryRail: boolean;
  secondaryDrawerOpened: boolean;
  setSecondaryDrawerOpened: (value: boolean) => void;
  workspaceDrawerOpened: boolean;
  setWorkspaceDrawerOpened: (value: boolean) => void;
  workspaceDrawerPadding: string;
  guardedNavigate: (to: string, replace?: boolean) => void;
  handleSectionChange: (section: AppShellLayoutProps['activeSection']) => void;
  sidebarAction?: React.ReactNode;
  sidebarControl?: React.ReactNode;
  showInlineSecondaryRail: boolean;
}) {
  const { layout } = props;

  return (
    <>
      {props.hasSecondaryRail ? (
        <Drawer
          opened={props.secondaryDrawerOpened}
          onClose={() => props.setSecondaryDrawerOpened(false)}
          title={layout.activeSectionLabel}
          position="left"
          size={SECONDARY_RAIL_WIDTH}
          padding={0}
          styles={{
            content: {
              backgroundColor: workspaceShellChromeStyles.secondaryRailBackground,
              display: 'flex',
              flexDirection: 'column',
            },
            header: {
              borderBottom: `1px solid ${workspaceShellChromeStyles.borderColor}`,
              backgroundColor: workspaceShellChromeStyles.topSurfaceBackground,
            },
            body: {
              padding: 0,
              backgroundColor: workspaceShellChromeStyles.secondaryRailBackground,
              flex: 1,
              minHeight: 0,
            },
          }}
        >
          <WorkspaceSecondaryRail
            activeProjectSlug={layout.activeProjectSlug}
            activeSchemaMode={layout.activeSchemaMode}
            activeSection={layout.activeSection}
            activeSectionLabel={layout.activeSectionLabel}
            activeSecondaryId={layout.activeSecondaryId}
            currentBranchName={layout.currentBranchName}
            onNavigate={props.guardedNavigate}
            secondaryOptions={layout.secondaryOptions}
            sidebarAction={props.sidebarAction}
            sidebarControl={props.sidebarControl}
            showInlineSecondaryRail={props.showInlineSecondaryRail}
          />
        </Drawer>
      ) : null}
      <Drawer
        opened={props.workspaceDrawerOpened}
        onClose={() => props.setWorkspaceDrawerOpened(false)}
        title={(
          <Group gap="xs" wrap="nowrap">
            <Text fw={600} truncate>{layout.currentProject.name}</Text>
            <Badge size="xs" variant="light" color="teal">{layout.currentBranchName}</Badge>
          </Group>
        )}
        position="left"
        size="100%"
        padding={0}
        styles={{
          content: {
            backgroundColor: workspaceShellChromeStyles.secondaryRailBackground,
            display: 'flex',
            flexDirection: 'column',
          },
          header: {
            borderBottom: `1px solid ${workspaceShellChromeStyles.borderColor}`,
            backgroundColor: workspaceShellChromeStyles.topSurfaceBackground,
            padding: props.workspaceDrawerPadding,
          },
          body: {
            backgroundColor: workspaceShellChromeStyles.secondaryRailBackground,
            padding: props.workspaceDrawerPadding,
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
          },
        }}
      >
        <WorkspaceDrawerNavigation
          activeProjectSlug={layout.activeProjectSlug}
          activeSchemaMode={layout.activeSchemaMode}
          activeSection={layout.activeSection}
          activeSectionLabel={layout.activeSectionLabel}
          activeSecondaryId={layout.activeSecondaryId}
          availableSections={layout.availableSections}
          currentBranchName={layout.currentBranchName}
          hasSecondaryRail={props.hasSecondaryRail}
          onNavigate={props.guardedNavigate}
          onSectionChange={props.handleSectionChange}
          secondaryOptions={layout.secondaryOptions}
          sidebarAction={props.sidebarAction}
          sidebarControl={props.sidebarControl}
        />
      </Drawer>
    </>
  );
}
