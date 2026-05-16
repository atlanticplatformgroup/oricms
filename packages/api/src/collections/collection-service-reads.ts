import type { CollectionConfig, CollectionEntry, ContentType } from '@ori/shared';
import type { GitService } from '../git/service';
import type { BranchCollectionIndex } from './collection-index';
import {
  getIndexedCollectionEntries,
  getIndexedCollectionEntriesById,
  loadCollectionEntries,
} from './collection-index';
import {
  applyCollectionSearchToEntries,
  getCollectionEntryAtCommitOrThrow,
  getCollectionEntryHistoryOrThrow,
  populateCollectionEntriesRelations,
} from './collection-read-operations';

export async function loadIndexedCollectionEntries(input: {
  index: BranchCollectionIndex;
  cacheKey: string;
  projectId: string;
  branch: string;
  config: CollectionConfig;
  entriesDir: string;
}): Promise<CollectionEntry[]> {
  return getIndexedCollectionEntries(input.index, input.cacheKey, () =>
    loadCollectionEntries({
      projectId: input.projectId,
      branch: input.branch,
      config: input.config,
      entriesDir: input.entriesDir,
    }),
  );
}

export async function loadIndexedCollectionEntriesById(input: {
  index: BranchCollectionIndex;
  cacheKey: string;
  projectId: string;
  branch: string;
  config: CollectionConfig;
  entriesDir: string;
}): Promise<Map<string, CollectionEntry>> {
  return getIndexedCollectionEntriesById(input.index, input.cacheKey, () =>
    loadCollectionEntries({
      projectId: input.projectId,
      branch: input.branch,
      config: input.config,
      entriesDir: input.entriesDir,
    }),
  );
}

export async function searchCollectionEntries(input: {
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
  return applyCollectionSearchToEntries(input);
}

export async function populateCollectionRelationsForEntries(input: {
  entries: CollectionEntry[];
  populate: string | string[];
  getContentType: (typeName: string) => Promise<ContentType | null>;
  findOne: (collectionId: string, id: string) => Promise<CollectionEntry | null>;
}): Promise<void> {
  return populateCollectionEntriesRelations(input);
}

export async function getCollectionHistory(input: {
  gitService: GitService;
  projectId: string;
  branch: string;
  collectionId: string;
  entryId: string;
  limit: number;
  getCollectionConfig: (collectionId: string) => Promise<CollectionConfig | null>;
  getResolvedPaths: (relativePath: string) => Promise<{ absolute: string; repoRelative: string }>;
}) {
  return getCollectionEntryHistoryOrThrow(input);
}

export async function getCollectionFileAtCommit(input: {
  gitService: GitService;
  projectId: string;
  branch: string;
  collectionId: string;
  entryId: string;
  hash: string;
  getCollectionConfig: (collectionId: string) => Promise<CollectionConfig | null>;
  getResolvedPaths: (relativePath: string) => Promise<{ absolute: string; repoRelative: string }>;
}) {
  return getCollectionEntryAtCommitOrThrow(input);
}
