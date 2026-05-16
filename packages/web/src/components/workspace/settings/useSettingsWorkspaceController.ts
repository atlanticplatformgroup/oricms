import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Environment, Project } from '@ori/shared';
import { gitApi } from '../../../lib/api/git';
import { projectsApi } from '../../../lib/api/projects';
import { useActionScopedLock } from '../../../hooks/useActionScopedLock';
import type { MappingDraft } from './types';
import {
  areEnvironmentSettingsDirty,
  buildBranchSettingsRecords,
  buildEnvironmentOptions,
  DEFAULT_MAPPING_DRAFT,
  getActiveSettingsView,
  getSettingsPageHeader,
  isGeneralSettingsDirty,
  makeEnvironmentId,
  normalizeEnvironmentOrder,
} from './settings-controller-support';
import { useSettingsWorkspaceMutations } from './useSettingsWorkspaceMutations';
import { canCreateBranchMapping, validateEnvironments } from './validation';

type ShowToast = (
  message: string,
  type?: 'success' | 'error' | 'warning' | 'info',
  options?: { duration?: number },
) => void;

export function useSettingsWorkspaceController({
  canManageGlobalMedia,
  currentBranchName,
  projectId,
  selectedView,
  showToast,
}: {
  canManageGlobalMedia: boolean;
  currentBranchName: string;
  projectId: string;
  selectedView: string;
  showToast: ShowToast;
}) {
  const queryClient = useQueryClient();
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [contentRoot, setContentRoot] = useState('content');
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [defaultEnvironmentId, setDefaultEnvironmentId] = useState<string>('');
  const [newMapping, setNewMapping] = useState<MappingDraft>(DEFAULT_MAPPING_DRAFT);

  const projectQuery = useQuery({
    queryKey: ['settings-workspace-project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: Boolean(projectId),
  });

  const branchMappingsQuery = useQuery({
    queryKey: ['settings-workspace-branch-mappings', projectId],
    queryFn: () => projectsApi.listBranchMappings(projectId),
    enabled: Boolean(projectId) && (selectedView === 'branches' || selectedView === 'environments'),
  });

  const branchesQuery = useQuery({
    queryKey: ['settings-workspace-branches', projectId, currentBranchName],
    queryFn: () => gitApi.getBranches(projectId),
    enabled: Boolean(projectId) && selectedView === 'branches',
  });

  const project = projectQuery.data?.project as Project | undefined;
  const currentBranch = branchesQuery.data?.current ?? null;

  useEffect(() => {
    if (!project) return;
    setProjectName(project.name || '');
    setProjectDescription(project.description || '');
    setContentRoot(project.settings?.contentRoot || 'content');
    setEnvironments(normalizeEnvironmentOrder(project.settings?.environments || []));
    setDefaultEnvironmentId(project.settings?.defaultEnvironmentId || '');
  }, [project]);

  const environmentOptions = useMemo(() => buildEnvironmentOptions(environments), [environments]);

  const branchSettingsRecords = useMemo(() => {
    return buildBranchSettingsRecords({
      mappings: branchMappingsQuery.data?.mappings || [],
      branches: branchesQuery.data?.branches || [],
      currentBranchName,
      environments,
    });
  }, [branchMappingsQuery.data?.mappings, branchesQuery.data?.branches, currentBranchName, environments]);

  const defaultCreateSourceBranch = useMemo(
    () => currentBranch || project?.defaultBranch || null,
    [currentBranch, project?.defaultBranch],
  );

  const sourceBranchOptions = useMemo(
    () => branchSettingsRecords.map((branch) => ({ value: branch.name, label: branch.name })),
    [branchSettingsRecords],
  );

  const generalDirty = useMemo(() => isGeneralSettingsDirty({
    project,
    projectName,
    projectDescription,
    contentRoot,
  }), [contentRoot, project, projectDescription, projectName]);

  const environmentsDirty = useMemo(() => areEnvironmentSettingsDirty({
    project,
    environments,
    defaultEnvironmentId,
  }), [defaultEnvironmentId, environments, project]);

  const environmentValidation = useMemo(() => validateEnvironments(environments), [environments]);

  const activeView = getActiveSettingsView(selectedView, canManageGlobalMedia);

  const settingsLock = useActionScopedLock({
    projectId,
    resourceType: 'projectSettings',
    resourceId: activeView === 'general' ? 'project-settings' : 'branch-settings',
    mode: 'hard',
    reason: 'configuring',
  });

  const {
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
  } = useSettingsWorkspaceMutations({
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
  });

  const pageHeader = getSettingsPageHeader(activeView);

  return {
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
    updateMappingMutation,
    setContentRoot,
    setDefaultEnvironmentId,
    setEnvironments,
    setNewMapping,
    setProjectDescription,
    setProjectName,
    runSettingsAction,
    addEnvironment: () => {
      const nextEnvironment: Environment = {
        id: makeEnvironmentId(),
        name: `Environment ${environments.length + 1}`,
        url: '',
        type: 'preview',
        order: environments.length,
      };
      setEnvironments((previous) => normalizeEnvironmentOrder([...previous, nextEnvironment]));
      if (!defaultEnvironmentId) setDefaultEnvironmentId(nextEnvironment.id);
    },
    deleteEnvironment: (environmentId: string) => {
      const next = environments.filter((item) => item.id !== environmentId);
      setEnvironments(normalizeEnvironmentOrder(next));
      if (defaultEnvironmentId === environmentId) setDefaultEnvironmentId(next[0]?.id || '');
    },
    updateEnvironment: (environmentId: string, updates: Partial<Environment>) => {
      setEnvironments((previous) => previous.map((item) => item.id === environmentId ? { ...item, ...updates } : item));
    },
    canCreateMapping: canCreateBranchMapping(newMapping.branchPattern),
  };
}
