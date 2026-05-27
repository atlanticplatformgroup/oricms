import path from 'path';
import fs from 'fs/promises';
import type { CollectionConfig } from '@ori/shared';
import { GitService } from '../git/service';
import { CollectionValidationError } from './collection-errors';
import type { ResolvePathFn } from './collection-repository-types';
import { validateCollectionConfigs } from './service-support';

export async function saveCollectionConfigs(options: {
  workspacePath: string;
  projectId: string;
  gitService: GitService;
  collections: CollectionConfig[];
  author: { name: string; email: string };
  message?: string;
}): Promise<void> {
  let validatedCollections: CollectionConfig[];
  try {
    validatedCollections = validateCollectionConfigs(options.collections);
  } catch (error) {
    throw new CollectionValidationError(error instanceof Error ? error.message : 'Invalid collection configuration');
  }

  const oricmsDir = path.join(options.workspacePath, 'oricms');
  await fs.mkdir(oricmsDir, { recursive: true });

  const configPath = path.join(oricmsDir, 'collections.json');
  const content = JSON.stringify(validatedCollections, null, 2) + '\n';

  await fs.writeFile(configPath, content);
  await options.gitService.commitAndPush(
    options.projectId,
    ['oricms/collections.json'],
    options.message || 'Update collection configurations',
    options.author,
  );
}

export async function deleteCollectionConfig(options: {
  workspacePath: string;
  projectId: string;
  gitService: GitService;
  collectionId: string;
  author: { name: string; email: string };
  listCollections: () => Promise<CollectionConfig[]>;
  getResolvedPaths: ResolvePathFn;
}): Promise<void> {
  const collections = await options.listCollections();
  const config = collections.find((collection) => collection.id === options.collectionId);
  if (!config) {
    throw new Error(`Collection '${options.collectionId}' not found`);
  }

  const nextCollections = collections.filter((collection) => collection.id !== options.collectionId);
  const { absolute: collectionDir, repoRelative: collectionRepoPath } = await options.getResolvedPaths(config.path);

  await fs.rm(collectionDir, { recursive: true, force: true });

  const oricmsDir = path.join(options.workspacePath, 'oricms');
  await fs.mkdir(oricmsDir, { recursive: true });

  const configPath = path.join(oricmsDir, 'collections.json');
  const content = JSON.stringify(nextCollections, null, 2) + '\n';
  await fs.writeFile(configPath, content);

  await options.gitService.commitAndPush(
    options.projectId,
    [collectionRepoPath, 'oricms/collections.json'],
    `Delete collection ${config.label} (${config.id}) and its entries`,
    options.author,
  );
}
