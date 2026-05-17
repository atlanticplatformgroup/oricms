import type { CollectionConfig } from '@ori/shared';
import { CollectionService } from '../../collections/service';
import { dispatchLifecycleEvent } from '../../plugins/dispatcher';
import { seedAgentWriteConfigsForProjectAgents } from '../../projects/agent-write-configs';
import type { CollectionMutationContext, SaveCollectionsResult } from './types';

function getAuthor(actor: CollectionMutationContext['actor']): { name: string; email: string } {
  return {
    name: actor?.name || 'Unknown',
    email: actor?.email || 'unknown@example.com',
  };
}

export async function saveCollectionsConfig(
  context: CollectionMutationContext,
  collections: CollectionConfig[],
): Promise<SaveCollectionsResult> {
  const service = new CollectionService({
    projectId: context.projectId,
    repoUrl: context.repoUrl ?? '',
    branch: context.branch,
  });
  await service.init();
  const existingCollections = await service.listCollections();
  const existingIds = new Set(existingCollections.map((collection) => collection.id));
  const createdCollections = collections.filter((collection) => !existingIds.has(collection.id));

  for (const collection of createdCollections) {
    await dispatchLifecycleEvent('collection.beforeCreate', {
      projectId: context.projectId,
      collectionId: collection.id,
      actor: context.actor,
      collection: collection as unknown as Record<string, unknown>,
    });
  }

  await service.saveCollections(collections, getAuthor(context.actor));

  await seedAgentWriteConfigsForProjectAgents({
    projectId: context.projectId,
    collectionNames: createdCollections.map((collection) => collection.id),
    existingCollectionNames: existingCollections.map((collection) => collection.id),
    targetBranch: context.branch,
  });

  for (const collection of createdCollections) {
    await dispatchLifecycleEvent('collection.afterCreate', {
      projectId: context.projectId,
      collectionId: collection.id,
      actor: context.actor,
      collection: collection as unknown as Record<string, unknown>,
    });
  }

  return { createdCollections };
}
