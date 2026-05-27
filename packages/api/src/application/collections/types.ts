import type { CollectionConfig } from '@ori/shared';

export interface CollectionMutationActor {
  id?: string;
  name?: string;
  email?: string;
}

export interface CollectionMutationContext {
  projectId: string;
  repoUrl?: string | null;
  branch: string;
  actor?: CollectionMutationActor;
}

export interface SaveCollectionsResult {
  createdCollections: CollectionConfig[];
}
