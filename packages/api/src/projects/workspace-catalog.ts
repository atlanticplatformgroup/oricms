import fs from 'fs/promises';
import path from 'path';
import type {
  CollectionConfig,
  CollectionSummary,
  ComponentSchema,
  ContentType,
  ProjectRole,
  SchemaDefinition,
  UiGroupSummary,
  WorkspaceCatalog,
} from '@ori/shared';
import { CollectionService } from '../collections/service';
import { gitService } from './runtime';
import { createCapabilities, SYSTEM_SURFACES } from './workspace-capabilities';
import { getWorkspaceProject, type WorkspaceProjectRecord } from './workspace-project-access';
import { normalizeUiGroups } from './workspace-ui-groups';

function normalizeCollectionDefinition(
  collection: CollectionConfig,
  role: ProjectRole,
  project: WorkspaceProjectRecord,
): CollectionConfig {
  return {
    ...collection,
    slug: collection.slug ?? collection.id,
    schemaId: collection.schemaId ?? collection.contentType ?? null,
    kind: collection.kind ?? 'user',
    visibility: collection.visibility ?? 'visible',
    locked: collection.locked ?? false,
    uiGroupId: collection.uiGroupId ?? null,
    storage: collection.storage ?? {
      adapter: 'git_repo',
      path: collection.path,
      branch: project.defaultBranch ?? 'main',
    },
    capabilities: collection.capabilities ?? createCapabilities(role, 'collections'),
    createdAt: collection.createdAt ?? project.createdAt.toISOString(),
    updatedAt: collection.updatedAt ?? project.updatedAt.toISOString(),
  };
}

async function readJsonSchemas<T>(directory: string): Promise<T[]> {
  try {
    const files = await fs.readdir(directory);
    const docs = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => JSON.parse(await fs.readFile(path.join(directory, file), 'utf-8')) as T),
    );
    return docs;
  } catch {
    return [];
  }
}

export async function buildWorkspaceCatalog(projectId: string, role: ProjectRole): Promise<WorkspaceCatalog> {
  const project = await getWorkspaceProject(projectId);
  if (!project) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  const collectionService = new CollectionService({
    projectId,
    repoUrl: project.repoUrl ?? '',
    branch: project.defaultBranch,
  });
  await collectionService.init();
  const rawCollections = await collectionService.listCollections();
  const collections: CollectionSummary[] = await Promise.all(
    rawCollections.map(async (collection) => {
      const result = await collectionService.findMany(collection.id, { page: 1, limit: 1 });
      return {
        collection: normalizeCollectionDefinition(collection, role, project),
        recordCount: result.meta.pagination.total,
      };
    }),
  );

  await gitService.ensureCloned(projectId);
  if (project.repoUrl) {
    await gitService.cloneOrPull(projectId, project.repoUrl, project.defaultBranch);
  }
  const workspacePath = gitService.getWorkspaceDir(projectId);
  const [contentTypes, componentSchemas] = await Promise.all([
    readJsonSchemas<ContentType>(path.join(workspacePath, 'schemas', 'types')),
    readJsonSchemas<ComponentSchema>(path.join(workspacePath, 'schemas', 'components')),
  ]);

  const schemas: SchemaDefinition[] = [
    ...contentTypes.map((schema) => ({
      id: schema.$id,
      slug: schema.name,
      label: schema.label,
      description: schema.description ?? null,
      kind: 'record' as const,
      locked: false,
      fields: schema.fields,
      capabilities: createCapabilities(role, 'schemas'),
    })),
    ...componentSchemas.map((schema) => ({
      id: schema.$id,
      slug: schema.name,
      label: schema.label,
      description: schema.description ?? null,
      kind: 'component' as const,
      locked: false,
      fields: schema.fields,
      capabilities: createCapabilities(role, 'schemas'),
    })),
  ].sort((left, right) => left.label.localeCompare(right.label));

  const uiGroups = normalizeUiGroups(
    (project.settings as Record<string, unknown> | null | undefined)?.uiGroups,
    role,
    project.createdAt.toISOString(),
    project.updatedAt.toISOString(),
  );

  const existingGroupIds = new Set(uiGroups.map((group) => group.id));
  const uiGroupSummaries: UiGroupSummary[] = uiGroups.map((group) => ({
    group,
    collectionIds: collections
      .filter(({ collection }) => collection.uiGroupId === group.id)
      .map(({ collection }) => collection.id),
  }));
  const ungroupedCollectionIds = collections
    .map(({ collection }) => collection)
    .filter((collection) => !collection.uiGroupId || !existingGroupIds.has(collection.uiGroupId))
    .map((collection) => collection.id);

  return {
    navigation: {
      systemSurfaces: SYSTEM_SURFACES,
      uiGroups: uiGroupSummaries,
      ungroupedCollectionIds,
    },
    collections,
    schemas,
  };
}
