import type { BranchEnvironmentMapping, Environment, GitBranch, Project } from '@ori/shared';
import type { BranchSettingsRecord, MappingDraft } from './types';

export const DEFAULT_MAPPING_DRAFT: MappingDraft = {
  branchPattern: '',
  environmentId: '',
  autoDeploy: true,
  deployOnMerge: false,
};

export function makeEnvironmentId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `env-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

export function normalizeEnvironmentOrder(environments: Environment[]) {
  return environments.map((environment, index) => ({ ...environment, order: index }));
}

function patternMatchesBranch(pattern: string, branchName: string): boolean {
  if (!pattern.includes('*')) return false;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(branchName);
}

export function buildEnvironmentOptions(environments: Environment[]) {
  return environments.map((environment) => ({
    value: environment.id,
    label: `${environment.name} (${environment.type})`,
  }));
}

export function buildBranchSettingsRecords(params: {
  mappings: BranchEnvironmentMapping[];
  branches: GitBranch[];
  currentBranchName: string;
  environments: Environment[];
}): BranchSettingsRecord[] {
  const environmentLabels = new Map(params.environments.map((environment) => [environment.id, environment.name]));

  return params.branches.map((branch) => {
    const exactMapping = params.mappings.find((mapping) => mapping.branchPattern === branch.name) || null;
    const hasPatternMapping = !exactMapping
      && params.mappings.some((mapping) => patternMatchesBranch(mapping.branchPattern, branch.name));
    const environmentLabel = exactMapping
      ? exactMapping.environmentId
        ? environmentLabels.get(exactMapping.environmentId) || 'Mapped environment'
        : 'No environment'
      : null;

    return {
      ...branch,
      isCurrent: branch.name === params.currentBranchName,
      environmentLabel,
      hasPatternMapping,
      exactMappingCount: exactMapping ? 1 : 0,
    };
  });
}

export function isGeneralSettingsDirty(params: {
  project?: Project;
  projectName: string;
  projectDescription: string;
  contentRoot: string;
}) {
  if (!params.project) return false;
  return (
    params.projectName !== (params.project.name || '')
    || params.projectDescription !== (params.project.description || '')
    || params.contentRoot !== (params.project.settings?.contentRoot || 'content')
  );
}

export function areEnvironmentSettingsDirty(params: {
  project?: Project;
  environments: Environment[];
  defaultEnvironmentId: string;
}) {
  if (!params.project) return false;
  return JSON.stringify(normalizeEnvironmentOrder(params.environments))
    !== JSON.stringify(normalizeEnvironmentOrder(params.project.settings?.environments || []))
    || params.defaultEnvironmentId !== (params.project.settings?.defaultEnvironmentId || '');
}

export function getActiveSettingsView(selectedView: string, canManageGlobalMedia: boolean) {
  if (selectedView === 'branches') return 'branches';
  if (selectedView === 'environments') return 'environments';
  if (selectedView === 'global-media' && canManageGlobalMedia) return 'global-media';
  return 'general';
}

export function getSettingsPageHeader(activeView: string) {
  if (activeView === 'branches') {
    return {
      title: 'Branches',
      description: 'Create, rename, and remove project branches.',
    };
  }
  if (activeView === 'environments') {
    return {
      title: 'Environments',
      description: 'Configure deployment targets and branch mappings.',
    };
  }
  if (activeView === 'global-media') {
    return {
      title: 'Global Media',
      description: 'Curate shared brand assets and reusable files for the organization.',
    };
  }
  return {
    title: 'General',
    description: 'Project identity and repository defaults.',
  };
}
