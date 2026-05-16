import path from 'path';
import type {
  ComponentSchema,
  CollectionConfig,
  CollectionEntry,
  ContentType,
} from '@ori/shared';
import { prisma } from '../lib/prisma';
import { GitService } from '../git/service';
import { CollectionService } from './service';
import {
  collectReferencedComponentIds,
  deepEqual,
  normalizeComponentSchemaForCompatibility,
  normalizeContentTypeForCompatibility,
} from './entry-branch-transfer-support';

type CollectionContext = {
  collection: CollectionConfig;
  contentType: ContentType | null;
  contentRoot: string;
};

export type SchemaCompatibility = {
  sourceCollection: CollectionConfig | null;
  targetCollection: CollectionConfig | null;
  sourceContentType: ContentType | null;
  matches: boolean;
  message: string | null;
};

export type TransferState = {
  sourceFilePath: string;
  sourceEntry: CollectionEntry | null;
  targetEntry: CollectionEntry | null;
  baseEntry: CollectionEntry | null;
  collection: CollectionConfig;
  contentType: ContentType | null;
  schemaCompatibility: SchemaCompatibility;
};

async function resolveCollectionContext(projectId: string, collectionId: string): Promise<CollectionContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, defaultBranch: true, settings: true, repoUrl: true },
  });
  if (!project) {
    throw new Error('Project not found');
  }

  const collectionService = new CollectionService({
    projectId,
    repoUrl: project.repoUrl ?? '',
    branch: project.defaultBranch,
  });
  await collectionService.init();

  const collection = await collectionService.getCollectionConfig(collectionId);
  if (!collection) {
    throw new Error(`Collection '${collectionId}' not found`);
  }

  const contentType = await collectionService.getContentType(collection.contentType);
  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const contentRoot = typeof settings.contentRoot === 'string' ? settings.contentRoot : '';

  return {
    collection,
    contentType,
    contentRoot,
  };
}

async function loadCollectionsConfigAtBranch(gitService: GitService, projectId: string, branch: string): Promise<CollectionConfig[]> {
  const content = await gitService.getFileAtBranch(projectId, branch, 'oricms/collections.json');
  if (!content) {
    return [];
  }

  try {
    return JSON.parse(content) as CollectionConfig[];
  } catch {
    return [];
  }
}

async function loadCollectionAtBranch(
  gitService: GitService,
  projectId: string,
  branch: string,
  collectionId: string,
): Promise<CollectionConfig | null> {
  const collections = await loadCollectionsConfigAtBranch(gitService, projectId, branch);
  return collections.find((collection) => collection.id === collectionId) ?? null;
}

async function loadContentTypeAtBranch(
  gitService: GitService,
  projectId: string,
  branch: string,
  contentTypeId: string,
): Promise<ContentType | null> {
  const content = await gitService.getFileAtBranch(projectId, branch, path.join('schemas', 'types', `${contentTypeId}.json`));
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as ContentType;
  } catch {
    return null;
  }
}

async function loadComponentSchemaAtBranch(
  gitService: GitService,
  projectId: string,
  branch: string,
  componentId: string,
): Promise<ComponentSchema | null> {
  const content = await gitService.getFileAtBranch(projectId, branch, path.join('schemas', 'components', `${componentId}.json`));
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as ComponentSchema;
  } catch {
    return null;
  }
}

async function resolveSchemaCompatibility(
  gitService: GitService,
  projectId: string,
  sourceBranch: string,
  targetBranch: string,
  collectionId: string,
): Promise<SchemaCompatibility> {
  const sourceCollection = await loadCollectionAtBranch(gitService, projectId, sourceBranch, collectionId);
  const targetCollection = await loadCollectionAtBranch(gitService, projectId, targetBranch, collectionId);

  if (!sourceCollection) {
    return {
      sourceCollection: null,
      targetCollection,
      sourceContentType: null,
      matches: false,
      message: `The "${collectionId}" collection does not exist on ${sourceBranch}.`,
    };
  }

  if (!targetCollection) {
    return {
      sourceCollection,
      targetCollection: null,
      sourceContentType: null,
      matches: false,
      message: `This entry can't be copied because the "${collectionId}" collection is missing on ${targetBranch}. Update the schema first, then try again.`,
    };
  }

  if (sourceCollection.contentType !== targetCollection.contentType) {
    return {
      sourceCollection,
      targetCollection,
      sourceContentType: null,
      matches: false,
      message: `This entry can't be copied because the collection uses different content types on ${sourceBranch} and ${targetBranch}. Update the schema first, then try again.`,
    };
  }

  if (sourceCollection.path !== targetCollection.path) {
    return {
      sourceCollection,
      targetCollection,
      sourceContentType: null,
      matches: false,
      message: `This entry can't be copied because the collection path differs between branches. Update the schema first, then try again.`,
    };
  }

  const sourceContentType = await loadContentTypeAtBranch(gitService, projectId, sourceBranch, sourceCollection.contentType);
  const targetContentType = await loadContentTypeAtBranch(gitService, projectId, targetBranch, targetCollection.contentType);

  if (!sourceContentType || !targetContentType) {
    return {
      sourceCollection,
      targetCollection,
      sourceContentType,
      matches: false,
      message: `This entry can't be copied because the content type schema is missing on one of the branches. Update the schema first, then try again.`,
    };
  }

  if (!deepEqual(normalizeContentTypeForCompatibility(sourceContentType), normalizeContentTypeForCompatibility(targetContentType))) {
    return {
      sourceCollection,
      targetCollection,
      sourceContentType,
      matches: false,
      message: `This entry can't be copied because the schema differs between branches. Update the schema first, then try again.`,
    };
  }

  const componentIds = collectReferencedComponentIds(sourceContentType.fields);
  for (const componentId of componentIds) {
    const [sourceComponent, targetComponent] = await Promise.all([
      loadComponentSchemaAtBranch(gitService, projectId, sourceBranch, componentId),
      loadComponentSchemaAtBranch(gitService, projectId, targetBranch, componentId),
    ]);

    if (!sourceComponent || !targetComponent) {
      return {
        sourceCollection,
        targetCollection,
        sourceContentType,
        matches: false,
        message: `This entry can't be copied because the "${componentId}" component schema is missing on one of the branches. Update the schema first, then try again.`,
      };
    }

    if (!deepEqual(
      normalizeComponentSchemaForCompatibility(sourceComponent),
      normalizeComponentSchemaForCompatibility(targetComponent),
    )) {
      return {
        sourceCollection,
        targetCollection,
        sourceContentType,
        matches: false,
        message: `This entry can't be copied because a referenced component schema differs between branches. Update the schema first, then try again.`,
      };
    }
  }

  return {
    sourceCollection,
    targetCollection,
    sourceContentType,
    matches: true,
    message: null,
  };
}

export async function loadTransferState(
  gitService: GitService,
  projectId: string,
  collectionId: string,
  entryId: string,
  sourceBranch: string,
  targetBranch: string,
): Promise<TransferState> {
  const fallbackContext = await resolveCollectionContext(projectId, collectionId);
  const schemaCompatibility = await resolveSchemaCompatibility(
    gitService,
    projectId,
    sourceBranch,
    targetBranch,
    collectionId,
  );
  const collection = schemaCompatibility.sourceCollection ?? fallbackContext.collection;
  const contentType = schemaCompatibility.sourceContentType ?? fallbackContext.contentType;
  const entryRepoPath = path.join(fallbackContext.contentRoot, collection.path);
  const sourceFilePath = path.join(entryRepoPath, `${entryId}.json`);

  const sourceContent = await gitService.getFileAtBranch(projectId, sourceBranch, sourceFilePath);
  const targetContent = await gitService.getFileAtBranch(projectId, targetBranch, sourceFilePath);
  const mergeBase = await gitService.getMergeBase(projectId, sourceBranch, targetBranch);
  const baseContent = mergeBase ? await gitService.getFileAtRef(projectId, mergeBase, sourceFilePath) : null;

  return {
    sourceFilePath,
    sourceEntry: sourceContent ? JSON.parse(sourceContent) as CollectionEntry : null,
    targetEntry: targetContent ? JSON.parse(targetContent) as CollectionEntry : null,
    baseEntry: baseContent ? JSON.parse(baseContent) as CollectionEntry : null,
    collection,
    contentType,
    schemaCompatibility,
  };
}
