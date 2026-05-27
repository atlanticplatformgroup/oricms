import type { CollectionConfig, CollectionEntry } from '@ori/shared';
import { GitService } from '../git/service';
import type { BranchCollectionIndex } from './collection-index';
import type { GetCollectionConfigFn, ResolvePathFn } from './collection-repository-types';
import { getCollectionFileAtCommit, getCollectionHistory } from './collection-service-reads';

export async function getCollectionEntryHistoryForBranch(options: {
  gitService: GitService;
  projectId: string;
  branch: string;
  collectionId: string;
  entryId: string;
  limit: number;
  getCollectionConfig: GetCollectionConfigFn;
  getResolvedPaths: ResolvePathFn;
}) {
  await options.gitService.ensureCloned(options.projectId);
  return getCollectionHistory({
    gitService: options.gitService,
    projectId: options.projectId,
    branch: options.branch,
    collectionId: options.collectionId,
    entryId: options.entryId,
    limit: options.limit,
    getCollectionConfig: options.getCollectionConfig,
    getResolvedPaths: options.getResolvedPaths,
  });
}

export async function getCollectionEntryAtCommitForBranch(options: {
  gitService: GitService;
  projectId: string;
  branch: string;
  collectionId: string;
  entryId: string;
  hash: string;
  getCollectionConfig: GetCollectionConfigFn;
  getResolvedPaths: ResolvePathFn;
}) {
  await options.gitService.ensureCloned(options.projectId);
  return getCollectionFileAtCommit({
    gitService: options.gitService,
    projectId: options.projectId,
    branch: options.branch,
    collectionId: options.collectionId,
    entryId: options.entryId,
    hash: options.hash,
    getCollectionConfig: options.getCollectionConfig,
    getResolvedPaths: options.getResolvedPaths,
  });
}

export async function loadBranchCollectionEntries(options: {
  index: BranchCollectionIndex;
  projectId: string;
  branch: string;
  config: CollectionConfig;
  getResolvedPaths: ResolvePathFn;
  loadIndexedCollectionEntries: (input: {
    index: BranchCollectionIndex;
    cacheKey: string;
    projectId: string;
    branch: string;
    config: CollectionConfig;
    entriesDir: string;
  }) => Promise<CollectionEntry[]>;
}): Promise<CollectionEntry[]> {
  const { absolute: entriesDir } = await options.getResolvedPaths(options.config.path);
  return options.loadIndexedCollectionEntries({
    index: options.index,
    cacheKey: `coll:${options.config.id}`,
    projectId: options.projectId,
    branch: options.branch,
    config: options.config,
    entriesDir,
  });
}

export async function loadBranchCollectionEntriesById(options: {
  index: BranchCollectionIndex;
  projectId: string;
  branch: string;
  config: CollectionConfig;
  getResolvedPaths: ResolvePathFn;
  loadIndexedCollectionEntriesById: (input: {
    index: BranchCollectionIndex;
    cacheKey: string;
    projectId: string;
    branch: string;
    config: CollectionConfig;
    entriesDir: string;
  }) => Promise<Map<string, CollectionEntry>>;
}): Promise<Map<string, CollectionEntry>> {
  const { absolute: entriesDir } = await options.getResolvedPaths(options.config.path);
  return options.loadIndexedCollectionEntriesById({
    index: options.index,
    cacheKey: `coll:${options.config.id}`,
    projectId: options.projectId,
    branch: options.branch,
    config: options.config,
    entriesDir,
  });
}
