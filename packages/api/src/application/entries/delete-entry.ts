import { CollectionService } from '../../collections/service';
import { apiServices } from '../../lib/api-services';
import { prisma } from '../../lib/prisma';
import { dispatchPluginHook } from '../../plugins/hook-dispatcher';
import { dispatchLifecycleEvent } from '../../plugins/dispatcher';
import { triggerEntryEnvironmentActions } from './environment-actions';
import { queueDeliveryProjectionReconcile } from '../../delivery-projection/shared';
import { getPrismaErrorResponse } from '../../lib/prisma';
import type { EntryMutationContext, EntryMutationDeps, EntryMutationOptions, EntryMutationResult } from './types';

function getAuthor(actor: EntryMutationContext['actor']): { name: string; email: string } {
  return {
    name: actor?.name || 'Unknown',
    email: actor?.email || 'unknown@example.com',
  };
}

export async function deleteEntry(
  context: EntryMutationContext,
  entryId: string,
  options: EntryMutationOptions = {},
  deps: EntryMutationDeps = {},
  baseRevision?: string,
): Promise<EntryMutationResult> {
  const prismaClient = deps.prismaClient ?? prisma;
  const pluginDispatcher = deps.dispatchPluginHook ?? dispatchPluginHook;
  const service = new CollectionService({
    projectId: context.projectId,
    repoUrl: context.repoUrl ?? '',
    branch: context.branch,
  });
  await service.init();

  await dispatchLifecycleEvent('entry.beforeDelete', {
    projectId: context.projectId,
    collectionId: context.collectionId,
    entryId,
    actor: context.actor,
  });

  const deleted = await service.delete(context.collectionId, entryId, getAuthor(context.actor), { baseRevision });

  await dispatchLifecycleEvent('entry.afterDelete', {
    projectId: context.projectId,
    collectionId: context.collectionId,
    entryId,
    actor: context.actor,
  });

  if (options.audit) {
    try {
      await prismaClient.auditLog.create({
        data: {
          projectId: context.projectId,
          userId: options.audit.userId,
          action: options.audit.action,
          resourceType: 'collection',
          resourceId: `${context.collectionId}/${entryId}`,
        },
      });
    } catch (error) {
      const prismaError = getPrismaErrorResponse(error);
      if (prismaError) {
        throw Object.assign(new Error(prismaError.message), { statusCode: prismaError.statusCode, code: prismaError.code });
      }
      throw error;
    }
  }

  if (options.plugin) {
    apiServices.runBackgroundTask(
      'plugin-hook:entry-delete',
      pluginDispatcher({
        projectId: context.projectId,
        event: options.plugin.event,
        resourceType: options.plugin.resourceType ?? 'collection',
        resourceId: `${context.collectionId}:${entryId}`,
        payload: {
          collectionId: context.collectionId,
          entryId,
        },
        actor: context.actor,
      }),
    );
  }

  triggerEntryEnvironmentActions({
    projectId: context.projectId,
    branch: context.branch,
    commitHash: deleted.commitHash,
    commitMessage: deleted.commitMessage,
    changedFiles: deleted.changedFiles,
  });

  queueDeliveryProjectionReconcile({
    projectId: context.projectId,
    repoUrl: context.repoUrl,
    branch: context.branch,
    label: 'delivery-projection:entry-delete',
  });

  return {
    entryId,
    revision: deleted.revision,
    previousEntry: deleted.previousEntry,
    commitHash: deleted.commitHash,
    commitMessage: deleted.commitMessage,
    changedFiles: deleted.changedFiles,
  };
}
