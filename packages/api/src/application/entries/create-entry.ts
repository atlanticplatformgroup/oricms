import type { Prisma } from '@prisma/client';
import { CollectionService } from '../../collections/service';
import { apiServices } from '../../lib/api-services';
import { prisma } from '../../lib/prisma';
import { dispatchPluginHook } from '../../plugins/hook-dispatcher';
import { dispatchLifecycleEvent } from '../../plugins/dispatcher';
import { triggerEntryEnvironmentActions } from './environment-actions';
import { queueDeliveryProjectionReconcile } from '../../delivery-projection/shared';
import type { EntryMutationContext, EntryMutationDeps, EntryMutationOptions, EntryMutationResult } from './types';

function getAuthor(actor: EntryMutationContext['actor']): { name: string; email: string } {
  return {
    name: actor?.name || 'Unknown',
    email: actor?.email || 'unknown@example.com',
  };
}

export async function createEntry(
  context: EntryMutationContext,
  data: Record<string, unknown>,
  options: EntryMutationOptions = {},
  deps: EntryMutationDeps = {},
): Promise<EntryMutationResult> {
  const prismaClient = deps.prismaClient ?? prisma;
  const pluginDispatcher = deps.dispatchPluginHook ?? dispatchPluginHook;
  const service = new CollectionService({
    projectId: context.projectId,
    repoUrl: context.repoUrl ?? '',
    branch: context.branch,
  });
  await service.init();

  await dispatchLifecycleEvent('entry.beforeCreate', {
    projectId: context.projectId,
    collectionId: context.collectionId,
    actor: context.actor,
    data,
  });

  const created = await service.create(context.collectionId, data, getAuthor(context.actor));
  const entry = created.entry;
  const entryId = String(entry.$id || '');

  await dispatchLifecycleEvent('entry.afterCreate', {
    projectId: context.projectId,
    collectionId: context.collectionId,
    entryId,
    actor: context.actor,
    entry,
  });

  if (options.audit) {
    await prismaClient.auditLog.create({
      data: {
        projectId: context.projectId,
        userId: options.audit.userId,
        action: options.audit.action,
        resourceType: 'collection',
        resourceId: `${context.collectionId}/${entryId}`,
        newValue: entry as unknown as Prisma.InputJsonValue,
      },
    });
  }

  if (options.plugin) {
    apiServices.runBackgroundTask(
      'plugin-hook:entry-create',
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
    commitHash: created.commitHash,
    commitMessage: created.commitMessage,
    changedFiles: created.changedFiles,
  });

  queueDeliveryProjectionReconcile({
    projectId: context.projectId,
    repoUrl: context.repoUrl,
    branch: context.branch,
    label: 'delivery-projection:entry-create',
  });

  return {
    entry,
    entryId,
    revision: created.revision,
    commitHash: created.commitHash,
    commitMessage: created.commitMessage,
    changedFiles: created.changedFiles,
  };
}
