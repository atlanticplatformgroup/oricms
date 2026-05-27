import path from 'path';
import type { ResourceSchemaDefinition } from '@ori/shared';
import { RESOURCE_COLLECTION_IDS, type SystemResourceContext } from './system-resources';

export async function getSystemResourceSchema(
  context: SystemResourceContext,
  resourceCollectionId: string,
): Promise<ResourceSchemaDefinition | null> {
  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.settings) {
    return {
      id: 'project.settings',
      label: 'Project Settings',
      kind: 'settings',
      document: { type: 'project.settings', schemaId: 'project.settings' },
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.members) {
    return {
      id: 'project.member',
      label: 'Project Member',
      kind: 'member',
      document: { type: 'project.member', schemaId: 'project.member' },
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.builds) {
    return {
      id: 'project.build',
      label: 'Build Run',
      kind: 'build',
      document: { type: 'project.build', schemaId: 'project.build' },
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.assets) {
    return {
      id: 'asset.metadata',
      label: 'Asset Metadata',
      kind: 'asset',
      document: { type: 'asset.metadata', schemaId: 'asset.metadata' },
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.schemaTypes) {
    return {
      id: 'content-type-v1',
      label: 'Content Type Schema',
      kind: 'content-type',
      document: { path: path.join(context.workspacePath, 'schemas', 'types') },
    };
  }

  if (resourceCollectionId === RESOURCE_COLLECTION_IDS.schemaComponents) {
    return {
      id: 'component-v1',
      label: 'Component Schema',
      kind: 'component',
      document: { path: path.join(context.workspacePath, 'schemas', 'components') },
    };
  }

  return null;
}
