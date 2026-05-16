import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../lib/prisma';
import type { CollectionConfig, CollectionEntry, ContentType } from '@ori/shared';
import type { GitService } from '../git/service';
import { getCollectionEntryAtCommit, getCollectionEntryHistory } from './collection-history';
import {
  buildBrowseRelationLabelsByField,
  populateCollectionRelations,
} from './collection-relations';
import { getCollectionBrowseSearchFields, matchesCollectionBrowseSearch } from './search';

export async function getCollectionProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    throw new Error('Project not found');
  }
  return project;
}

export async function resolveCollectionPaths(input: {
  workspacePath: string;
  projectId: string;
  relativePath: string;
}): Promise<{ absolute: string; repoRelative: string }> {
  const project = await getCollectionProject(input.projectId);
  const settings = (project.settings || {}) as { contentRoot?: string };
  const contentRoot = settings.contentRoot || '';
  const repoRelative = path.join(contentRoot, input.relativePath);

  return {
    absolute: path.join(input.workspacePath, repoRelative),
    repoRelative,
  };
}

export async function listCollectionConfigs(workspacePath: string): Promise<CollectionConfig[]> {
  const configPath = path.join(workspacePath, 'oricms', 'collections.json');

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const collections = JSON.parse(content) as CollectionConfig[];
    return collections || [];
  } catch {
    return [];
  }
}

export function findCollectionConfig(
  collections: CollectionConfig[],
  collectionId: string
): CollectionConfig | null {
  return collections.find((collection) => collection.id === collectionId) || null;
}

export async function readCollectionContentType(
  workspacePath: string,
  typeName: string
): Promise<ContentType | null> {
  const typeFile = path.join(workspacePath, 'schemas', 'types', `${typeName}.json`);

  try {
    const content = await fs.readFile(typeFile, 'utf-8');
    const typeDef = JSON.parse(content) as ContentType;
    if (typeDef.$schema === 'content-type-v1') {
      return typeDef;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getCollectionEntryHistoryOrThrow(input: {
  gitService: GitService;
  projectId: string;
  branch: string;
  collectionId: string;
  entryId: string;
  limit: number;
  getCollectionConfig: (collectionId: string) => Promise<CollectionConfig | null>;
  getResolvedPaths: (relativePath: string) => Promise<{ repoRelative: string }>;
}) {
  const config = await input.getCollectionConfig(input.collectionId);
  if (!config) {
    const err = new Error(`Collection '${input.collectionId}' not found`);
    (err as { code?: string }).code = 'NOT_FOUND';
    throw err;
  }

  const { repoRelative: entryPath } = await input.getResolvedPaths(
    path.join(config.path, `${input.entryId}.json`)
  );
  return getCollectionEntryHistory({
    gitService: input.gitService,
    projectId: input.projectId,
    branch: input.branch,
    limit: input.limit,
    entryPath,
  });
}

export async function getCollectionEntryAtCommitOrThrow(input: {
  gitService: GitService;
  projectId: string;
  branch: string;
  collectionId: string;
  entryId: string;
  hash: string;
  getCollectionConfig: (collectionId: string) => Promise<CollectionConfig | null>;
  getResolvedPaths: (relativePath: string) => Promise<{ repoRelative: string }>;
}) {
  const config = await input.getCollectionConfig(input.collectionId);
  if (!config) {
    const err = new Error(`Collection '${input.collectionId}' not found`);
    (err as { code?: string }).code = 'NOT_FOUND';
    throw err;
  }

  const { repoRelative: entryPath } = await input.getResolvedPaths(
    path.join(config.path, `${input.entryId}.json`)
  );
  return getCollectionEntryAtCommit({
    gitService: input.gitService,
    projectId: input.projectId,
    branch: input.branch,
    entryPath,
    hash: input.hash,
  });
}

export async function applyCollectionSearchToEntries(input: {
  entries: CollectionEntry[];
  search: string;
  contentType: ContentType;
  projectId: string;
  branch: string;
  getCurrentRevision: () => Promise<string>;
  listCollections: () => Promise<CollectionConfig[]>;
  getContentType: (typeName: string) => Promise<ContentType | null>;
  getEntries: (config: CollectionConfig) => Promise<CollectionEntry[]>;
}): Promise<CollectionEntry[]> {
  const browseFields = getCollectionBrowseSearchFields(input.contentType);
  const relationLabelsByField = await buildBrowseRelationLabelsByField({
    projectId: input.projectId,
    branch: input.branch,
    fields: browseFields,
    getCurrentRevision: input.getCurrentRevision,
    listCollections: input.listCollections,
    getContentType: input.getContentType,
    getEntries: input.getEntries,
  });

  return input.entries.filter((entry) =>
    matchesCollectionBrowseSearch(
      entry,
      input.search,
      input.contentType,
      relationLabelsByField
    )
  );
}

export async function populateCollectionEntriesRelations(input: {
  entries: CollectionEntry[];
  populate: string | string[];
  getContentType: (typeName: string) => Promise<ContentType | null>;
  findOne: (collectionId: string, id: string) => Promise<CollectionEntry | null>;
}): Promise<void> {
  await populateCollectionRelations({
    entries: input.entries,
    populate: input.populate,
    getContentType: input.getContentType,
    findOne: input.findOne,
  });
}
