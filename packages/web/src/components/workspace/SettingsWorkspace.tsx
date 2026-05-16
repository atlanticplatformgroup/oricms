import { Alert } from '@mantine/core';
import { WorkspaceErrorState, WorkspaceHeader, WorkspaceLoadingState, WorkspacePage } from '../ui/WorkspacePrimitives';
import { BranchesSettingsView } from './settings/BranchesSettingsView';
import { EnvironmentsSettingsView } from './settings/EnvironmentsSettingsView';
import { GeneralSettingsView } from './settings/GeneralSettingsView';
import { GlobalMediaSettingsView } from './settings/GlobalMediaSettingsView';
import { useSettingsWorkspaceController } from './settings/useSettingsWorkspaceController';

interface SettingsWorkspaceProps {
  projectId: string;
  currentBranchName: string;
  selectedView: string;
  canManageGlobalMedia: boolean;
  canCreateAssets: boolean;
  canUpdateAssets: boolean;
  canDeleteAssets: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', options?: { duration?: number }) => void;
}
export function SettingsWorkspace({
  projectId,
  currentBranchName,
  selectedView,
  canManageGlobalMedia,
  canCreateAssets,
  canUpdateAssets,
  canDeleteAssets,
  showToast,
}: SettingsWorkspaceProps) {
  const {
    activeView,
    branchMappingsQuery,
    branchSettingsRecords,
    branchesQuery,
    contentRoot,
    createBranchMutation,
    createMappingMutation,
    defaultCreateSourceBranch,
    defaultEnvironmentId,
    deleteBranchMutation,
    deleteEnvironment,
    deleteMappingMutation,
    environmentOptions,
    environmentValidation,
    environments,
    environmentsDirty,
    generalDirty,
    newMapping,
    pageHeader,
    project,
    projectDescription,
    projectName,
    projectQuery,
    renameBranchMutation,
    saveEnvironmentsMutation,
    saveGeneralMutation,
    settingsBusy,
    settingsLock,
    sourceBranchOptions,
    updateEnvironment,
    updateMappingMutation,
    setContentRoot,
    setDefaultEnvironmentId,
    setNewMapping,
    setProjectDescription,
    setProjectName,
    runSettingsAction,
    addEnvironment,
    canCreateMapping,
  } = useSettingsWorkspaceController({
    canManageGlobalMedia,
    currentBranchName,
    projectId,
    selectedView,
    showToast,
  });

  return (
    <WorkspacePage>
      <WorkspaceHeader
        title={pageHeader.title}
        description={pageHeader.description}
      />

      {settingsLock.blockingLock ? (
        <Alert color="yellow" title={settingsLock.blockingLock.holderName ? `Locked by ${settingsLock.blockingLock.holderName}` : 'Settings locked'}>
          {settingsLock.blockingLock.holderName
            ? `${settingsLock.blockingLock.holderName} is editing these settings. Try again after their editing session ends.`
            : 'These settings are currently locked for editing.'}
        </Alert>
      ) : settingsLock.error ? (
        <Alert color="red" title="Unable to edit settings">{settingsLock.error}</Alert>
      ) : null}

      {projectQuery.isLoading ? (
        <WorkspaceLoadingState label="Loading settings…" />
      ) : projectQuery.isError || !project ? (
        <WorkspaceErrorState title="Failed to load settings" message="Project settings are unavailable right now." onRetry={() => void projectQuery.refetch()} />
      ) : activeView === 'general' ? (
        <GeneralSettingsView
          project={project}
          projectName={projectName}
          projectDescription={projectDescription}
          contentRoot={contentRoot}
          generalDirty={generalDirty}
          savePending={saveGeneralMutation.isPending}
          readOnly={settingsBusy}
          onProjectNameChange={setProjectName}
          onProjectDescriptionChange={setProjectDescription}
          onContentRootChange={setContentRoot}
          onSave={() => {
            void runSettingsAction((headers) => saveGeneralMutation.mutateAsync({ headers }));
          }}
        />
      ) : activeView === 'branches' ? (
        <BranchesSettingsView
          loading={branchesQuery.isLoading}
          error={branchesQuery.isError}
          branches={branchSettingsRecords}
          sourceBranchOptions={sourceBranchOptions}
          defaultSourceBranch={defaultCreateSourceBranch}
          createPending={createBranchMutation.isPending}
          renamePending={renameBranchMutation.isPending}
          deletePending={deleteBranchMutation.isPending}
          readOnly={settingsBusy}
          onCreateBranch={(name, fromBranch) => {
            void runSettingsAction((headers) => createBranchMutation.mutateAsync({ name, fromBranch, headers }));
          }}
          onRenameBranch={(branchName, nextBranchName) => {
            void runSettingsAction((headers) => renameBranchMutation.mutateAsync({ branchName, nextBranchName, headers }));
          }}
          onDeleteBranch={(branchName) => {
            void runSettingsAction((headers) => deleteBranchMutation.mutateAsync({ branchName, headers }));
          }}
          onRetry={() => void branchesQuery.refetch()}
        />
      ) : activeView === 'environments' ? (
        <EnvironmentsSettingsView
          environments={environments}
          environmentOptions={environmentOptions}
          defaultEnvironmentId={defaultEnvironmentId}
          environmentsDirty={environmentsDirty}
          savePending={saveEnvironmentsMutation.isPending}
          readOnly={settingsBusy}
          validation={environmentValidation}
          onAddEnvironment={addEnvironment}
          onSave={() => {
            void runSettingsAction((headers) => saveEnvironmentsMutation.mutateAsync({ headers }));
          }}
          onDefaultEnvironmentChange={setDefaultEnvironmentId}
          onDeleteEnvironment={deleteEnvironment}
          onUpdateEnvironment={updateEnvironment}
          mappingsLoading={branchMappingsQuery.isLoading}
          mappingsError={branchMappingsQuery.isError}
          mappings={branchMappingsQuery.data?.mappings || []}
          newMapping={newMapping}
          createPending={createMappingMutation.isPending}
          updatePending={updateMappingMutation.isPending}
          deletePending={deleteMappingMutation.isPending}
          canCreateMapping={canCreateMapping}
          onNewMappingChange={(updates) => setNewMapping((previous) => ({ ...previous, ...updates }))}
          onCreateMapping={() => {
            void runSettingsAction((headers) => createMappingMutation.mutateAsync({ headers }));
          }}
          onUpdateMapping={(mappingId, data) => {
            void runSettingsAction((headers) => updateMappingMutation.mutateAsync({ mappingId, data, headers }));
          }}
          onDeleteMapping={(mappingId) => {
            void runSettingsAction((headers) => deleteMappingMutation.mutateAsync({ mappingId, headers }));
          }}
        />
      ) : activeView === 'global-media' ? (
        <GlobalMediaSettingsView
          projectId={projectId}
          canCreateAssets={canCreateAssets}
          canUpdateAssets={canUpdateAssets}
          canDeleteAssets={canDeleteAssets}
          showToast={showToast}
        />
      ) : null}
    </WorkspacePage>
  );
}
