import type { Dispatch, SetStateAction } from 'react';
import { useMutation, type QueryClient } from '@tanstack/react-query';
import type { BranchEnvironmentMapping, Environment, Project } from '@ori/shared';
import { gitApi } from '../../../lib/api/git';
import { projectsApi } from '../../../lib/api/projects';
import type { useActionScopedLock } from '../../../hooks/useActionScopedLock';
import type { MappingDraft } from './types';
import { DEFAULT_MAPPING_DRAFT, normalizeEnvironmentOrder } from './settings-controller-support';

type ShowToast = (
  message: string,
  type?: 'success' | 'error' | 'warning' | 'info',
  options?: { duration?: number },
) => void;

type SettingsLock = ReturnType<typeof useActionScopedLock>;

export function useSettingsWorkspaceMutations(params: {
  projectId: string;
  project?: Project;
  projectName: string;
  projectDescription: string;
  contentRoot: string;
  environments: Environment[];
  defaultEnvironmentId: string;
  newMapping: MappingDraft;
  showToast: ShowToast;
  queryClient: QueryClient;
  settingsLock: SettingsLock;
  setNewMapping: Dispatch<SetStateAction<MappingDraft>>;
}) {
  const {
    projectId,
    project,
    projectName,
    projectDescription,
    contentRoot,
    environments,
    defaultEnvironmentId,
    newMapping,
    showToast,
    queryClient,
    settingsLock,
    setNewMapping,
  } = params;

  const saveGeneralMutation = useMutation({
    mutationFn: ({ headers }: { headers: Record<string, string> }) =>
      projectsApi.update(projectId, {
        name: projectName.trim(),
        description: projectDescription.trim() || null,
        settings: {
          ...(project?.settings || {}),
          contentRoot: contentRoot.trim() || 'content',
        },
      } as Partial<Project>, headers),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-workspace-project', projectId] });
      showToast('General settings saved', 'success');
    },
    onError: () => showToast('Failed to save settings', 'error'),
  });

  const saveEnvironmentsMutation = useMutation({
    mutationFn: ({ headers }: { headers: Record<string, string> }) =>
      projectsApi.update(projectId, {
        settings: {
          ...(project?.settings || {}),
          environments: normalizeEnvironmentOrder(environments),
          defaultEnvironmentId: defaultEnvironmentId || undefined,
        },
      } as Partial<Project>, headers),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-workspace-project', projectId] });
      showToast('Environment settings saved', 'success');
    },
    onError: () => showToast('Failed to save environments', 'error'),
  });

  const createMappingMutation = useMutation({
    mutationFn: ({ headers }: { headers: Record<string, string> }) =>
      projectsApi.createBranchMapping(projectId, {
        branchPattern: newMapping.branchPattern.trim(),
        environmentId: newMapping.environmentId || null,
        autoDeploy: newMapping.autoDeploy,
        deployOnMerge: newMapping.deployOnMerge,
      }, headers),
    onSuccess: async () => {
      setNewMapping(DEFAULT_MAPPING_DRAFT);
      await queryClient.invalidateQueries({ queryKey: ['settings-workspace-branch-mappings', projectId] });
      showToast('Branch mapping created', 'success');
    },
    onError: () => showToast('Failed to create branch mapping', 'error'),
  });

  const updateMappingMutation = useMutation({
    mutationFn: ({ mappingId, data, headers }: {
      mappingId: string;
      data: Partial<Pick<BranchEnvironmentMapping, 'branchPattern' | 'environmentId' | 'autoDeploy' | 'deployOnMerge'>>;
      headers: Record<string, string>;
    }) => projectsApi.updateBranchMapping(projectId, mappingId, data, headers),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-workspace-branch-mappings', projectId] });
    },
    onError: () => showToast('Failed to update branch mapping', 'error'),
  });

  const deleteMappingMutation = useMutation({
    mutationFn: ({ mappingId, headers }: { mappingId: string; headers: Record<string, string> }) =>
      projectsApi.deleteBranchMapping(projectId, mappingId, headers),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings-workspace-branch-mappings', projectId] });
      showToast('Branch mapping removed', 'success');
    },
    onError: () => showToast('Failed to delete branch mapping', 'error'),
  });

  const createBranchMutation = useMutation({
    mutationFn: ({ name, fromBranch, headers }: { name: string; fromBranch: string; headers: Record<string, string> }) =>
      gitApi.createBranch(projectId, name, fromBranch, headers),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['settings-workspace-branches', projectId] });
      showToast(`Created branch ${variables.name}`, 'success');
    },
    onError: (error) => showToast(error instanceof Error ? error.message : 'Failed to create branch', 'error'),
  });

  const renameBranchMutation = useMutation({
    mutationFn: ({ branchName, nextBranchName, headers }: {
      branchName: string;
      nextBranchName: string;
      headers: Record<string, string>;
    }) => gitApi.renameBranch(projectId, branchName, nextBranchName, headers),
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['settings-workspace-branches', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['settings-workspace-branch-mappings', projectId] });
      const suffix = data.updatedMappings ? ` Updated ${data.updatedMappings} branch mapping${data.updatedMappings === 1 ? '' : 's'}.` : '';
      showToast(`Renamed branch ${variables.branchName} to ${variables.nextBranchName}.${suffix}`, 'success');
    },
    onError: (error) => showToast(error instanceof Error ? error.message : 'Failed to rename branch', 'error'),
  });

  const deleteBranchMutation = useMutation({
    mutationFn: ({ branchName, headers }: { branchName: string; headers: Record<string, string> }) =>
      gitApi.deleteBranch(projectId, branchName, headers),
    onSuccess: async (data, branchName) => {
      await queryClient.invalidateQueries({ queryKey: ['settings-workspace-branches', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['settings-workspace-branch-mappings', projectId] });
      const suffix = data.removedMappings ? ` Removed ${data.removedMappings} branch mapping${data.removedMappings === 1 ? '' : 's'}.` : '';
      showToast(`Deleted branch ${branchName}.${suffix}`, 'success');
    },
    onError: (error) => showToast(error instanceof Error ? error.message : 'Failed to delete branch', 'error'),
  });

  const settingsBusy = settingsLock.isPending
    || saveGeneralMutation.isPending
    || saveEnvironmentsMutation.isPending
    || createMappingMutation.isPending
    || updateMappingMutation.isPending
    || deleteMappingMutation.isPending
    || createBranchMutation.isPending
    || renameBranchMutation.isPending
    || deleteBranchMutation.isPending;

  const runSettingsAction = async <T,>(action: (headers: Record<string, string>) => Promise<T>) => {
    try {
      return await settingsLock.runWithLock(action);
    } catch {
      return null;
    }
  };

  return {
    createBranchMutation,
    createMappingMutation,
    deleteBranchMutation,
    deleteMappingMutation,
    renameBranchMutation,
    runSettingsAction,
    saveEnvironmentsMutation,
    saveGeneralMutation,
    settingsBusy,
    updateMappingMutation,
  };
}
