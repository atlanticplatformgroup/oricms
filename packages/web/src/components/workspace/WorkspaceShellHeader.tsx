import { memo } from 'react';
import { Badge, Box, Group, Menu, Select, Stack } from '@mantine/core';
import { CircleUserRound, Menu as MenuIcon } from 'lucide-react';
import { WorkspaceBranchSwitcher } from '../ui/WorkspaceBranchSwitcher';
import { OriMark } from '../ui/OriMark';
import { WorkspaceHeaderActionIcon, WorkspaceToolbarButton, workspaceShellChromeStyles } from '../ui/WorkspacePrimitives';
import { PRIMARY_RAIL_WIDTH } from '../../lib/workspace/constants';
import { buildWorkspacePath } from '../../lib/workspace/routing';
import type { SectionKey } from '../../lib/workspace/types';
import type { ProjectWithRole } from '../../contexts/project-context';

type UserSummary = {
  email?: string | null;
  name?: string | null;
};

type WorkspaceShellHeaderProps = {
  activeCollectionSettingsView: boolean;
  activeEntryId: string | null;
  activeHistoryView: boolean;
  activeProjectSlug: string | null;
  activeSchemaMode: 'types' | 'components';
  activeSection: SectionKey;
  activeSectionLabel: string;
  activeSecondaryId: string | null;
  confirmDiscardChanges: () => boolean;
  currentBranchName: string;
  currentProject: ProjectWithRole;
  headerHeight: number;
  isLoadingProjects: boolean;
  isMobileShell: boolean;
  logout: () => Promise<void> | void;
  navigateTo: (to: string, replace?: boolean) => void;
  onOpenWorkspaceDrawer: () => void;
  projects: ProjectWithRole[];
  setCurrentProject: (project: ProjectWithRole | null) => void;
  user: UserSummary | null | undefined;
};

export const WorkspaceShellHeader = memo(function WorkspaceShellHeader({
  activeCollectionSettingsView,
  activeEntryId,
  activeHistoryView,
  activeProjectSlug,
  activeSchemaMode,
  activeSection,
  activeSectionLabel,
  activeSecondaryId,
  confirmDiscardChanges,
  currentBranchName,
  currentProject,
  headerHeight,
  isLoadingProjects,
  isMobileShell,
  logout,
  navigateTo,
  onOpenWorkspaceDrawer,
  projects,
  setCurrentProject,
  user,
}: WorkspaceShellHeaderProps) {
  const guardedNavigate = (to: string) => {
    if (!confirmDiscardChanges()) return;
    navigateTo(to);
  };

  const projectOptions = projects.map((project) => ({ value: project.id, label: project.name }));

  const handleBranchSelect = (branchName: string) => {
    if (!activeProjectSlug) return;
    guardedNavigate(buildWorkspacePath(activeProjectSlug, activeSection, activeSecondaryId, {
      branchName,
      entryId: activeEntryId,
      schemaMode: activeSchemaMode,
      historyView: activeHistoryView,
      collectionSettingsView: activeCollectionSettingsView,
    }));
  };

  const handleNavigateToBranches = () => {
    if (!activeProjectSlug) return;
    guardedNavigate(buildWorkspacePath(activeProjectSlug, 'settings', 'branches', { branchName: currentBranchName }));
  };

  const projectSwitcher = (
    <Select
      placeholder="Select project"
      data={projectOptions}
      value={currentProject.id}
      data-testid="project-switcher"
      disabled={isLoadingProjects || projectOptions.length === 0}
      w={isMobileShell ? undefined : 300}
      maw="100%"
      miw={0}
      style={{ flex: isMobileShell ? '1 1 auto' : undefined }}
      onChange={(projectId) => {
        const nextProject = projects.find((project) => project.id === projectId);
        if (!nextProject) return;
        if (!confirmDiscardChanges()) return;
        setCurrentProject(nextProject);
        guardedNavigate(buildWorkspacePath(nextProject.slug, 'collections', null, { branchName: nextProject.defaultBranch }));
      }}
    />
  );

  const userMenu = (
    <Menu position="bottom-end" shadow="md">
      <Menu.Target>
        {isMobileShell ? (
          <WorkspaceHeaderActionIcon ariaLabel="User menu">
            <CircleUserRound size={18} />
          </WorkspaceHeaderActionIcon>
        ) : (
          <WorkspaceToolbarButton>{user?.name || user?.email || 'User'}</WorkspaceToolbarButton>
        )}
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{user?.email || 'Authenticated user'}</Menu.Label>
        <Menu.Item onClick={() => { if (!confirmDiscardChanges()) return; void logout(); }}>Sign out</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  return (
    <Group h={headerHeight} gap={0} wrap="nowrap" align="stretch">
      <Box
        w={PRIMARY_RAIL_WIDTH}
        miw={PRIMARY_RAIL_WIDTH}
        h="100%"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: `1px solid ${workspaceShellChromeStyles.borderColor}`,
        }}
      >
        <OriMark />
      </Box>
      <Box flex={1} miw={0}>
        {isMobileShell ? (
          <Stack gap="xs" justify="center" h="100%" px="md" py="xs">
            <Group justify="space-between" wrap="nowrap" gap="sm" miw={0}>
              <WorkspaceToolbarButton
                onClick={onOpenWorkspaceDrawer}
                leftSection={<MenuIcon size={16} />}
                style={{ flexShrink: 0 }}
                data-testid="workspace-nav-trigger"
              >
                {activeSectionLabel}
              </WorkspaceToolbarButton>
              <Group gap="xs" wrap="nowrap" miw={0} style={{ flexShrink: 0 }}>
                <WorkspaceBranchSwitcher
                  projectId={currentProject.id}
                  currentBranchName={currentBranchName}
                  compact
                  onBeforeSwitch={confirmDiscardChanges}
                  onSelectBranch={handleBranchSelect}
                  onNavigateToBranches={handleNavigateToBranches}
                />
                {userMenu}
              </Group>
            </Group>
            <Group gap="sm" wrap="nowrap" miw={0}>
              {projectSwitcher}
            </Group>
          </Stack>
        ) : (
          <Group
            justify="space-between"
            h="100%"
            wrap="wrap"
            pl="md"
            pr="md"
            gap="xs"
            style={{
              alignContent: 'center',
            }}
          >
            <Group wrap="wrap" gap="sm" miw={0} flex={1}>
              {projectSwitcher}
              <Badge variant="light" color="blue">{currentProject.role}</Badge>
            </Group>
            <Group wrap="wrap" gap="sm" miw={0} justify="flex-end">
              <WorkspaceBranchSwitcher
                projectId={currentProject.id}
                currentBranchName={currentBranchName}
                onBeforeSwitch={confirmDiscardChanges}
                onSelectBranch={handleBranchSelect}
                onNavigateToBranches={handleNavigateToBranches}
              />
              {userMenu}
            </Group>
          </Group>
        )}
      </Box>
    </Group>
  );
});
