import { useEffect, useMemo, useState, type FormEvent, lazy, Suspense } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Center, Container, Group, Loader, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { useAuth } from './contexts/useAuth';
import { useProject, useProjectPermissions } from './contexts/useProject';
import { WorkspaceRouterProvider, useWorkspaceRouterContext } from './contexts/workspace/WorkspaceRouterContext';
import { useToast } from './contexts/ToastContext';
import { useGitStatus } from './hooks/useGitStatus';
import { useCollectionBrowseModel } from './hooks/useCollectionBrowseModel';
import { SECONDARY_RAIL_STORAGE_KEY } from './lib/workspace/constants';
import { workspaceExtensionRegistry } from './lib/workspace/registry';
import { buildWorkspacePath } from './lib/workspace/routing';
import { useWorkspaceData } from './hooks/useWorkspaceData';
import { useCollectionConfigPersistence } from './hooks/useCollectionConfigPersistence';
import { useWorkspaceBranchSync } from './hooks/useWorkspaceBranchSync';
import { useWorkspaceCapabilities } from './hooks/useWorkspaceCapabilities';
import { useWorkspaceRouteNormalization } from './hooks/useWorkspaceRouteNormalization';
import { projectsApi } from './lib/api/projects';

const WorkspaceAppContent = lazy(() => import('./components/workspace/WorkspaceAppContent'));

function slugifyProjectName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function FirstProjectOnboarding({
  setCurrentProject,
  refreshProjects,
}: {
  setCurrentProject: ReturnType<typeof useProject>['setCurrentProject'];
  refreshProjects: ReturnType<typeof useProject>['refreshProjects'];
}) {
  const [projectName, setProjectName] = useState('My First Project');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    const name = projectName.trim() || 'Untitled Project';
    const slug = slugifyProjectName(name) || `project-${Date.now().toString().slice(-6)}`;

    setIsCreating(true);
    setError(null);

    try {
      const { project } = await projectsApi.create({ name, slug });
      setCurrentProject({ ...project, role: 'owner' });
      await refreshProjects();
      showToast('Project created. Welcome to your workspace.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Container size="sm" py="xl">
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="lg">
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
              No projects yet
            </Text>
            <Title order={1} ta="center">
              Create your first project
            </Title>
            <Text c="dimmed" ta="center" maw={560}>
              Start with a managed Git-backed project. You can connect a remote repository, refine schemas,
              and invite teammates after the workspace opens.
            </Text>
          </Stack>

          {error ? (
            <Alert color="red" title="Project creation failed">
              {error}
            </Alert>
          ) : null}

          <form onSubmit={createProject}>
            <Stack gap="md">
              <TextInput
                label="Project name"
                description="OriCMS will use this to create a clean workspace URL slug."
                value={projectName}
                required
                onChange={(event) => setProjectName(event.currentTarget.value)}
                placeholder="Marketing site"
              />
              <Group justify="flex-end">
                <Button type="submit" disabled={isCreating} leftSection={isCreating ? <Loader size="xs" /> : undefined}>
                  Create project
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  );
}

function AppWithRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { currentProject, projects, setCurrentProject, isLoadingProjects, refreshProjects } = useProject();
  const { hasPermission } = useProjectPermissions();
  const { status: gitStatus, refresh: refreshGitStatus } = useGitStatus();
  const queryClient = useQueryClient();

  const {
    activeEntryId,
    activeHistoryView,
    activeCollectionSettingsView,
    activeBranchName,
    activeProjectSlug,
    activeSchemaMode,
    activeSecondaryId,
    activeSection,
    redirectTo,
  } = useWorkspaceRouterContext();

  const [secondaryRailCollapsed, setSecondaryRailCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SECONDARY_RAIL_STORAGE_KEY) === 'true';
  });

  const availableSections = useMemo(
    () => workspaceExtensionRegistry.getSections().filter((config) => hasPermission(config.permission.resource, config.permission.action)),
    [hasPermission],
  );
  const capabilities = useWorkspaceCapabilities(hasPermission);
  const navigateTo = (to: string, replace = false) => navigate(to, replace ? { replace: true } : undefined);

  const { currentBranchName, isBranchSyncing, dataBranchName } = useWorkspaceBranchSync({
    projectId: currentProject?.id ?? null,
    projectDefaultBranch: currentProject?.defaultBranch ?? null,
    activeProjectSlug,
    activeBranchName,
    activeSection,
    activeSecondaryId,
    activeEntryId,
    activeSchemaMode,
    activeHistoryView,
    activeCollectionSettingsView,
    gitBranchName: gitStatus?.branch,
    queryClient,
    refreshGitStatus,
    showToast,
    navigate,
  });

  const {
    collectionsQuery,
    contentTypes,
    collections,
    componentSchemaMap,
    assetOptions,
    assetMap,
    secondaryOptions,
    selectedSecondaryOption,
    selectedCollection,
    selectedContentType,
    primaryField,
    secondaryField,
    tableAssetMap,
    selectedEntryQuery,
    selectedEntryRevision,
    selectedSchema,
    selectedSchemaDocument,
    schemaSecondaryOptions,
    assetsQuery,
    globalAssetsQuery,
    globalAssetRecords,
    componentSchemasQuery,
  } = useWorkspaceData({
    projectId: currentProject?.id ?? null,
    activeSection,
    activeSecondaryId,
    activeEntryId,
    activeSchemaMode,
    branchName: dataBranchName,
    canManageGlobalMedia: capabilities.canManageGlobalMedia,
  });

  const collectionBrowse = useCollectionBrowseModel({
    projectId: currentProject?.id ?? null,
    branchName: dataBranchName,
    activeSecondaryId,
    selectedCollection,
    selectedContentType,
    collections,
    contentTypes,
    tableAssetMap,
  });

  const selectedEntry = useMemo(
    () => collectionBrowse.entries.find((entry) => entry.$id === activeEntryId) ?? selectedEntryQuery.data?.entry ?? null,
    [activeEntryId, collectionBrowse.entries, selectedEntryQuery.data],
  );
  const selectedEntryLoading = selectedEntryQuery.isLoading && !selectedEntry;
  const selectedEntryError = selectedEntryQuery.isError && !selectedEntry;

  const {
    updateCollectionsConfigMutation,
    deleteCollectionMutation,
  } = useCollectionConfigPersistence({
    projectId: currentProject?.id ?? null,
    activeProjectSlug,
    activeBranchName: currentBranchName,
    activeSection,
    showToast,
    queryClient,
    navigate,
  });

  const activeSectionLabel = workspaceExtensionRegistry.getSection(activeSection)?.label ?? 'Workspace';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SECONDARY_RAIL_STORAGE_KEY, String(secondaryRailCollapsed));
  }, [secondaryRailCollapsed]);

  useWorkspaceRouteNormalization({
    activeProjectSlug,
    currentProjectSlug: currentProject?.slug ?? null,
    pathname: location.pathname,
    navigate,
    availableSections,
    activeSection,
    activeSecondaryId,
    currentBranchName,
    activeSchemaMode,
    collections,
    collectionsLoading: collectionsQuery.isLoading,
    schemaSecondaryOptions,
    secondaryOptions,
    isBranchSyncing,
  });

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  if (!isLoadingProjects && projects.length === 0 && !currentProject) {
    return <FirstProjectOnboarding setCurrentProject={setCurrentProject} refreshProjects={refreshProjects} />;
  }

  if (!currentProject || isBranchSyncing) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  return (
    <Suspense
      fallback={
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      }
    >
      <WorkspaceAppContent
        activeProjectSlug={activeProjectSlug}
        currentBranchName={currentBranchName}
        collectionManagerProps={{
          selectedCollection,
          collections,
          contentTypes,
          selectedCollectionEntryCount: collectionBrowse.selectedCollectionEntryCount,
          showToast,
          onPersistCreate: async (nextCollection, headers) => {
            await updateCollectionsConfigMutation.mutateAsync({
              nextCollections: [...collections, nextCollection],
              nextCollectionId: nextCollection.id,
              action: 'save',
              headers,
            });
          },
          onPersistSaveSettings: async (nextCollections, nextCollectionId, headers) => {
            await updateCollectionsConfigMutation.mutateAsync({
              nextCollections,
              nextCollectionId,
              action: 'save',
              headers,
            });
          },
          onPersistDelete: async (collectionId, nextCollectionId, headers) => {
            await deleteCollectionMutation.mutateAsync({
              collectionId,
              nextCollectionId,
              headers,
            });
          },
        }}
        editorProps={{
          projectId: currentProject.id,
          selectedCollection,
          selectedContentType,
          selectedEntry,
          selectedEntryRevision,
          entries: collectionBrowse.entries,
          primaryField,
          collections,
          contentTypes,
          componentSchemaMap,
          assetOptions,
          assetMap,
          assetsLoading: assetsQuery.isLoading || globalAssetsQuery.isLoading,
          assetRecords: assetsQuery.data?.assets ?? [],
          globalAssetRecords,
          canCreateEntries: capabilities.canCreateEntries,
          canUpdateEntries: capabilities.canUpdateEntries,
          canDeleteEntries: capabilities.canDeleteEntries,
          showToast,
          queryClient,
          onNavigateToEntry: (entryId: string) => {
            if (!activeProjectSlug || !selectedCollection) return;
            navigateTo(buildWorkspacePath(activeProjectSlug, 'collections', selectedCollection.id, { entryId, branchName: currentBranchName }));
          },
          onNavigateToCollection: () => {
            if (!activeProjectSlug || !selectedCollection) return;
            navigateTo(buildWorkspacePath(activeProjectSlug, 'collections', selectedCollection.id, { branchName: currentBranchName }), true);
          },
        }}
        entryHistoryProps={{
          projectId: currentProject.id,
          selectedCollection,
          selectedEntry,
          activeHistoryView,
          canUpdateEntries: capabilities.canUpdateEntries,
          currentBranchName,
        }}
        schemaEditorProps={{
          projectId: currentProject.id,
          activeSchemaMode,
          selectedSchema,
          selectedSchemaDocument,
          showToast,
          queryClient,
        }}
        navigateTo={navigateTo}
        workspaceShellProps={{
          currentProject,
          projects,
          setCurrentProject,
          isLoadingProjects,
          user,
          logout,
          gitStatus,
          availableSections,
          activeSection,
          activeSectionLabel,
          secondaryRailCollapsed,
          setSecondaryRailCollapsed,
          canCreateCollections: capabilities.canCreateCollections,
          activeSchemaMode,
          componentSchemaData: componentSchemasQuery.data ?? [],
          contentTypes,
          collections,
          activeProjectSlug,
          navigateTo,
          secondaryOptions,
          activeSecondaryId,
          selectedSecondaryOption,
          showToast,
          refreshGitStatus,
          canCreateAssets: capabilities.canCreateAssets,
          canUpdateAssets: capabilities.canUpdateAssets,
          canDeleteAssets: capabilities.canDeleteAssets,
          canManageGlobalMedia: capabilities.canManageGlobalMedia,
          currentBranchName,
          selectedCollection,
          activeEntryId,
          activeHistoryView,
          activeCollectionSettingsView,
          selectedEntry,
          primaryField,
          secondaryField,
          collectionBrowse,
          canCreateEntries: capabilities.canCreateEntries,
          canUpdateEntries: capabilities.canUpdateEntries,
          canDeleteEntries: capabilities.canDeleteEntries,
          canUpdateCollections: capabilities.canUpdateCollections,
          canDeleteCollections: capabilities.canDeleteCollections,
          selectedEntryLoading,
          selectedEntryError,
          retrySelectedEntry: () => {
            collectionBrowse.retryEntries();
            void selectedEntryQuery.refetch();
          },
          selectedSchemaDocument,
          updateCollectionsConfigPending: updateCollectionsConfigMutation.isPending,
          assetsQueryLoading: assetsQuery.isLoading || globalAssetsQuery.isLoading,
        }}
      />
    </Suspense>
  );
}

function App() {
  const { currentProject, projects, setCurrentProject, isLoadingProjects } = useProject();

  return (
    <WorkspaceRouterProvider
      projects={projects}
      currentProject={currentProject}
      setCurrentProject={setCurrentProject}
      isLoadingProjects={isLoadingProjects}
    >
      <AppWithRouter />
    </WorkspaceRouterProvider>
  );
}

export default App;
