import type {
  AgentAccessConfig,
  AgentSessionBootstrap,
  AgentWritePolicy,
  CollectionConfig,
  ProjectRole,
} from '@ori/shared';
import { buildBootstrapSummaryMarkdown, buildConfigFreshness } from './bootstrap';

type RawWriteConfig = {
  collectionName: string;
  mode: string;
  targetBranch: string | null;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  updatedAt: Date;
};

export function buildSessionBootstrapPayload(input: {
  project: { id: string; name: string };
  selectedBranch: string;
  projectRole: ProjectRole;
  config: AgentAccessConfig;
  allowedCollectionConfigs: CollectionConfig[];
  writeConfigs: RawWriteConfig[];
  hasPermission: (
    resource: 'collections',
    action: 'create' | 'read' | 'update' | 'delete' | 'publish',
  ) => boolean;
}): AgentSessionBootstrap {
  const readableCollections = input.hasPermission('collections', 'read')
    ? input.allowedCollectionConfigs.map((collection) => collection.id)
    : [];

  const writePolicies: AgentWritePolicy[] = input.writeConfigs
    .map((policy) => ({
      collectionName: policy.collectionName,
      mode: policy.mode as AgentWritePolicy['mode'],
      targetBranch: policy.targetBranch ?? '',
      canCreate: input.hasPermission('collections', 'create') && policy.canCreate,
      canUpdate: input.hasPermission('collections', 'update') && policy.canUpdate,
      canDelete: input.hasPermission('collections', 'delete') && policy.canDelete,
    }))
    .filter((policy) => policy.canCreate || policy.canUpdate || policy.canDelete);

  const writableCollections = writePolicies.map((policy) => policy.collectionName);
  const publishableCollections = input.hasPermission('collections', 'publish')
    ? input.allowedCollectionConfigs.map((collection) => collection.id)
    : [];
  const serializedWriteConfigs = input.writeConfigs.map((policy) => ({
    collectionName: policy.collectionName,
    mode: policy.mode,
    targetBranch: policy.targetBranch ?? '',
    canCreate: policy.canCreate,
    canUpdate: policy.canUpdate,
    canDelete: policy.canDelete,
    updatedAt: policy.updatedAt.toISOString(),
  }));
  const freshness = buildConfigFreshness({
    branch: input.selectedBranch,
    allowedBranches: input.config.allowedBranches,
    allowedCollections: input.config.allowedCollections,
    configUpdatedAt: input.config.updatedAt,
    projectId: input.project.id,
    projectRole: input.projectRole,
    writeConfigs: serializedWriteConfigs,
  });

  return {
    project: {
      id: input.project.id,
      name: input.project.name,
      branch: input.selectedBranch,
      role: input.projectRole,
    },
    capabilities: {
      allowedBranches: input.config.allowedBranches,
      readableCollections,
      writableCollections,
      publishableCollections,
    },
    contentModel: {
      collections: input.allowedCollectionConfigs.map((collection) => ({
        id: collection.id,
        label: collection.label,
        contentType: collection.contentType,
      })),
    },
    entryIdentity: {
      canonicalField: '$id',
      slugIsCanonicalId: false,
      useReturnedEntryIdAfterCreate: true,
    },
    workflow: {
      defaultEntryStatus: 'draft',
      readyStatusValue: 'published',
      readyStatusLabel: 'Ready',
      publishRequiresExplicitIntent: true,
      destructiveChangesRequireConfirmation: true,
    },
    writePolicies,
    summaryMarkdown: buildBootstrapSummaryMarkdown({
      allowedBranches: input.config.allowedBranches,
      projectName: input.project.name,
      branch: input.selectedBranch,
      projectRole: input.projectRole,
      readableCollections,
      writableCollections,
      contentCollections: input.allowedCollectionConfigs.map((collection) => ({
        id: collection.id,
        contentType: collection.contentType,
      })),
      writePolicies,
    }),
    generatedAt: freshness.generatedAt,
    configVersion: freshness.configVersion,
    configUpdatedAt: freshness.configUpdatedAt,
  };
}
