import type { CollectionConfig } from '@ori/shared';

export type CollectionProject = {
  repoUrl: string | null;
  defaultBranch: string;
};

export type ResolvedPath = {
  absolute: string;
  repoRelative: string;
};

export type ResolvePathFn = (relativePath: string) => Promise<ResolvedPath>;
export type GetCollectionConfigFn = (collectionId: string) => Promise<CollectionConfig | null>;
