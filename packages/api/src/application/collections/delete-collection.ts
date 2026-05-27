import { PLUGIN_EVENT_NAMES } from '@ori/shared';
import { CollectionService } from '../../collections/service';
import { apiServices } from '../../lib/api-services';
import { dispatchPluginHook } from '../../plugins/hook-dispatcher';
import { dispatchLifecycleEvent } from '../../plugins/dispatcher';
import type { CollectionMutationContext } from './types';
import { queueDeliveryProjectionReconcile } from '../../delivery-projection/shared';

function getAuthor(actor: CollectionMutationContext['actor']): { name: string; email: string } {
  return {
    name: actor?.name || 'Unknown',
    email: actor?.email || 'unknown@example.com',
  };
}

export async function deleteCollection(
  context: CollectionMutationContext,
  collectionId: string,
): Promise<void> {
  const service = new CollectionService({
    projectId: context.projectId,
    repoUrl: context.repoUrl ?? '',
    branch: context.branch,
  });
  await service.init();

  await dispatchLifecycleEvent('collection.beforeDelete', {
    projectId: context.projectId,
    collectionId,
    actor: context.actor,
  });

  await service.deleteCollection(collectionId, getAuthor(context.actor));

  await dispatchLifecycleEvent('collection.afterDelete', {
    projectId: context.projectId,
    collectionId,
    actor: context.actor,
  });

  apiServices.runBackgroundTask(
    'plugin-hook:collection-delete',
    dispatchPluginHook({
      projectId: context.projectId,
      event: PLUGIN_EVENT_NAMES.COLLECTION_DELETED,
      resourceType: 'collection',
      resourceId: collectionId,
      payload: { collectionId },
      actor: context.actor,
    }),
  );

  queueDeliveryProjectionReconcile({
    projectId: context.projectId,
    repoUrl: context.repoUrl,
    branch: context.branch,
    label: 'delivery-projection:collection-delete',
  });
}
