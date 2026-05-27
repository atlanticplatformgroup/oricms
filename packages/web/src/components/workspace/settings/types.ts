import type { BranchEnvironmentMapping, Environment, GitBranch, Project } from '@ori/shared';

export type MappingDraft = {
  branchPattern: string;
  environmentId: string;
  autoDeploy: boolean;
  deployOnMerge: boolean;
};

export type EnvironmentValidation = {
  name?: string;
  url?: string;
  buildWebhook?: string;
  revalidationUrl?: string;
};

export type EnvironmentValidationMap = Record<string, EnvironmentValidation>;

export type GeneralSettingsViewProps = {
  project: Project;
  projectName: string;
  projectDescription: string;
  contentRoot: string;
  generalDirty: boolean;
  savePending: boolean;
  readOnly?: boolean;
  onProjectNameChange: (value: string) => void;
  onProjectDescriptionChange: (value: string) => void;
  onContentRootChange: (value: string) => void;
  onSave: () => void;
};

export type GlobalMediaSettingsViewProps = {
  projectId: string;
  canCreateAssets: boolean;
  canUpdateAssets: boolean;
  canDeleteAssets: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', options?: { duration?: number }) => void;
};

export type EnvironmentSettingsViewProps = {
  environments: Environment[];
  environmentOptions: Array<{ value: string; label: string }>;
  defaultEnvironmentId: string;
  environmentsDirty: boolean;
  savePending: boolean;
  readOnly?: boolean;
  validation: EnvironmentValidationMap;
  onAddEnvironment: () => void;
  onSave: () => void;
  onDefaultEnvironmentChange: (value: string) => void;
  onDeleteEnvironment: (environmentId: string) => void;
  onUpdateEnvironment: (environmentId: string, updates: Partial<Environment>) => void;
  mappingsLoading: boolean;
  mappingsError: boolean;
  mappings: BranchEnvironmentMapping[];
  newMapping: MappingDraft;
  createPending: boolean;
  updatePending: boolean;
  deletePending: boolean;
  canCreateMapping: boolean;
  onNewMappingChange: (updates: Partial<MappingDraft>) => void;
  onCreateMapping: () => void;
  onUpdateMapping: (mappingId: string, data: Partial<Pick<BranchEnvironmentMapping, 'branchPattern' | 'environmentId' | 'autoDeploy' | 'deployOnMerge'>>) => void;
  onDeleteMapping: (mappingId: string) => void;
};

export type BranchSettingsRecord = GitBranch & {
  environmentLabel: string | null;
  hasPatternMapping: boolean;
  exactMappingCount: number;
};

export type BranchesSettingsViewProps = {
  loading: boolean;
  error: boolean;
  branches: BranchSettingsRecord[];
  sourceBranchOptions: Array<{ value: string; label: string }>;
  defaultSourceBranch: string | null;
  createPending: boolean;
  renamePending: boolean;
  deletePending: boolean;
  readOnly?: boolean;
  onCreateBranch: (name: string, fromBranch: string) => void;
  onRenameBranch: (branchName: string, nextBranchName: string) => void;
  onDeleteBranch: (branchName: string) => void;
  onRetry?: () => void;
};
