import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { AppShell, Center, Loader } from '@mantine/core';
import { useWorkspaceShellMode } from '../../hooks/useWorkspaceShellMode';
import { useCollectionManagerContext } from '../../contexts/workspace/CollectionManagerContext';
import { useEditorContext } from '../../contexts/workspace/EditorContext';
import { workspaceShellChromeStyles } from '../ui/WorkspacePrimitives';
import type { SectionKey } from '../../lib/workspace/types';
import { DEFAULT_SCHEMA_SECONDARY, PRIMARY_RAIL_WIDTH, SECONDARY_RAIL_WIDTH, SECONDARY_TOGGLE_WIDTH } from '../../lib/workspace/constants';
import { getSectionSecondaryNavigation, workspaceExtensionRegistry } from '../../lib/workspace/registry';
import { buildWorkspacePath } from '../../lib/workspace/routing';
import { WorkspaceShellHeader } from './WorkspaceShellHeader';
import { WorkspacePrimaryRail, WorkspaceSecondaryRail, WorkspaceSecondaryRailBoundaryToggle } from './WorkspaceShellNavigation';
import { WorkspaceShellDrawers } from './WorkspaceShellDrawers';
import type { AppShellLayoutProps } from './WorkspaceShellLayout.types';

const WorkspaceShellMainContent = lazy(() => import('./WorkspaceShellMainContent').then((m) => ({ default: m.WorkspaceShellMainContent })));

export function AppShellLayout(props: AppShellLayoutProps) {
  const {
    activeProjectSlug,
    setSecondaryRailCollapsed,
    secondaryOptions,
    selectedCollection,
    activeSchemaMode,
    componentSchemaData,
    contentTypes,
    currentBranchName,
    navigateTo,
  } = props;

  const entryEditor = useEditorContext();
  const collectionManager = useCollectionManagerContext();
  const { isWideShell, isNarrowShell, isMobileShell } = useWorkspaceShellMode();
  const [secondaryDrawerOpened, setSecondaryDrawerOpened] = useState(false);
  const [workspaceDrawerOpened, setWorkspaceDrawerOpened] = useState(false);
  const confirmDiscardChanges = useCallback((): boolean => {
    if (!entryEditor.isDirty) return true;
    return window.confirm('You have unsaved changes. Discard them?');
  }, [entryEditor.isDirty]);
  const guardedNavigate = useCallback((to: string, replace = false) => {
    if (!confirmDiscardChanges()) return;
    navigateTo(to, replace);
  }, [confirmDiscardChanges, navigateTo]);
  const activeSectionRegistration = workspaceExtensionRegistry.getSection(props.activeSection);
  const secondaryNavigationMode = getSectionSecondaryNavigation(props.activeSection);
  const hasSecondaryRail = secondaryNavigationMode === 'rail' && props.secondaryOptions.length > 0;
  const headerHeight = isMobileShell ? 112 : 64;
  const showInlinePrimaryRail = !isMobileShell;
  const showInlineSecondaryRail = hasSecondaryRail && isWideShell;
  const showSecondaryRailTrigger = hasSecondaryRail && isNarrowShell;
  const workspaceDrawerPadding = 'var(--mantine-spacing-md)';
  const navbarWidth = isMobileShell
    ? 0
    : showInlineSecondaryRail
      ? (props.secondaryRailCollapsed ? PRIMARY_RAIL_WIDTH + SECONDARY_TOGGLE_WIDTH : PRIMARY_RAIL_WIDTH + SECONDARY_RAIL_WIDTH)
      : PRIMARY_RAIL_WIDTH + (showSecondaryRailTrigger ? SECONDARY_TOGGLE_WIDTH : 0);

  useEffect(() => {
    if (isWideShell) {
      setSecondaryDrawerOpened(false);
      setWorkspaceDrawerOpened(false);
    }
  }, [isWideShell]);

  useEffect(() => {
    if (!isMobileShell) {
      setWorkspaceDrawerOpened(false);
    }
  }, [isMobileShell]);

  useEffect(() => {
    if (!isNarrowShell) {
      setSecondaryDrawerOpened(false);
    }
  }, [isNarrowShell]);

  const handleSectionChange = useCallback((section: SectionKey) => {
    if (!activeProjectSlug) return;
    setSecondaryRailCollapsed(false);
    setWorkspaceDrawerOpened(false);
    setSecondaryDrawerOpened(false);
    if (section === 'collections') {
      guardedNavigate(buildWorkspacePath(activeProjectSlug, 'collections', secondaryOptions[0]?.id ?? selectedCollection?.id ?? null, { branchName: currentBranchName }));
      return;
    }
    if (section === 'schemas') {
      const fallback = activeSchemaMode === 'components'
        ? (componentSchemaData[0]?.schema.$id || DEFAULT_SCHEMA_SECONDARY)
        : (contentTypes[0]?.$id || DEFAULT_SCHEMA_SECONDARY);
      guardedNavigate(buildWorkspacePath(activeProjectSlug, 'schemas', fallback, { schemaMode: activeSchemaMode, branchName: currentBranchName }));
      return;
    }
    guardedNavigate(buildWorkspacePath(activeProjectSlug, section, null, { branchName: currentBranchName }));
  }, [activeProjectSlug, setSecondaryRailCollapsed, secondaryOptions, selectedCollection, activeSchemaMode, componentSchemaData, contentTypes, currentBranchName, guardedNavigate]);

  const handleSelectEntry = useCallback((entryId: string) => {
    if (!selectedCollection || !activeProjectSlug) return;
    setWorkspaceDrawerOpened(false);
    setSecondaryDrawerOpened(false);
    guardedNavigate(buildWorkspacePath(activeProjectSlug, 'collections', selectedCollection.id, { entryId, branchName: currentBranchName }));
  }, [selectedCollection, activeProjectSlug, currentBranchName, guardedNavigate]);

  const sidebarAction = activeSectionRegistration?.renderSidebarAction?.({
    canCreateCollections: props.canCreateCollections,
    onCreateCollection: collectionManager.openCreateCollection,
  });
  const sidebarControl = activeSectionRegistration?.renderSidebarControl?.({
    activeProjectSlug: props.activeProjectSlug,
    activeBranchName: props.currentBranchName,
    activeSchemaMode: props.activeSchemaMode,
    componentSchemaData: props.componentSchemaData,
    contentTypes: props.contentTypes,
    navigateTo: guardedNavigate,
  });

  return (
    <AppShell
      header={{ height: headerHeight }}
      navbar={{ width: navbarWidth, breakpoint: 0 }}
      padding={isMobileShell ? 'sm' : 'md'}
      styles={{
        header: {
          backgroundColor: workspaceShellChromeStyles.headerBackground,
          borderBottomColor: workspaceShellChromeStyles.borderColor,
        },
        navbar: {
          backgroundColor: workspaceShellChromeStyles.secondaryRailBackground,
          borderInlineEndColor: workspaceShellChromeStyles.borderColor,
        },
        main: {
          backgroundColor: workspaceShellChromeStyles.mainBackground,
        },
      }}
    >
      <AppShell.Header>
        <WorkspaceShellHeader
          activeCollectionSettingsView={props.activeCollectionSettingsView}
          activeEntryId={props.activeEntryId}
          activeHistoryView={props.activeHistoryView}
          activeProjectSlug={props.activeProjectSlug}
          activeSchemaMode={props.activeSchemaMode}
          activeSection={props.activeSection}
          activeSectionLabel={props.activeSectionLabel}
          activeSecondaryId={props.activeSecondaryId}
          confirmDiscardChanges={confirmDiscardChanges}
          currentBranchName={props.currentBranchName}
          currentProject={props.currentProject}
          headerHeight={headerHeight}
          isLoadingProjects={props.isLoadingProjects}
          isMobileShell={isMobileShell}
          logout={props.logout}
          navigateTo={props.navigateTo}
          onOpenWorkspaceDrawer={() => setWorkspaceDrawerOpened(true)}
          projects={props.projects}
          setCurrentProject={props.setCurrentProject}
          user={props.user}
        />
      </AppShell.Header>
      {showInlinePrimaryRail ? (
        <AppShell.Navbar px={0} py={0}>
          <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', gap: 0, minWidth: 0 }}>
            <WorkspacePrimaryRail
              activeSection={props.activeSection}
              availableSections={props.availableSections}
              onSectionChange={handleSectionChange}
            />
            <WorkspaceSecondaryRailBoundaryToggle
              secondaryRailCollapsed={props.secondaryRailCollapsed}
              showInlineSecondaryRail={showInlineSecondaryRail}
              showSecondaryRailTrigger={showSecondaryRailTrigger}
              onExpandInline={() => props.setSecondaryRailCollapsed(false)}
              onExpandDrawer={() => setSecondaryDrawerOpened(true)}
            />
            {showInlineSecondaryRail ? (
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: workspaceShellChromeStyles.secondaryRailBackground,
                }}
              >
                {props.secondaryRailCollapsed ? null : (
                  <WorkspaceSecondaryRail
                    activeProjectSlug={props.activeProjectSlug}
                    activeSchemaMode={props.activeSchemaMode}
                    activeSection={props.activeSection}
                    activeSectionLabel={props.activeSectionLabel}
                    activeSecondaryId={props.activeSecondaryId}
                    currentBranchName={props.currentBranchName}
                    onCollapse={() => props.setSecondaryRailCollapsed(true)}
                    onNavigate={guardedNavigate}
                    secondaryOptions={props.secondaryOptions}
                    sidebarAction={sidebarAction}
                    sidebarControl={sidebarControl}
                    showInlineSecondaryRail={showInlineSecondaryRail}
                  />
                )}
              </div>
            ) : null}
          </div>
        </AppShell.Navbar>
      ) : null}
      <AppShell.Main style={{ minWidth: 0, overflowX: 'auto' }}>
        <Suspense fallback={<Center py="xl"><Loader size="sm" /></Center>}>
          <WorkspaceShellMainContent
            layout={props}
            guardedNavigate={guardedNavigate}
            handleSelectEntry={handleSelectEntry}
          />
        </Suspense>
      </AppShell.Main>
      <WorkspaceShellDrawers
        layout={props}
        hasSecondaryRail={hasSecondaryRail}
        secondaryDrawerOpened={secondaryDrawerOpened}
        setSecondaryDrawerOpened={setSecondaryDrawerOpened}
        workspaceDrawerOpened={workspaceDrawerOpened}
        setWorkspaceDrawerOpened={setWorkspaceDrawerOpened}
        workspaceDrawerPadding={workspaceDrawerPadding}
        guardedNavigate={guardedNavigate}
        handleSectionChange={handleSectionChange}
        sidebarAction={sidebarAction}
        sidebarControl={sidebarControl}
        showInlineSecondaryRail={showInlineSecondaryRail}
      />
    </AppShell>
  );
}
