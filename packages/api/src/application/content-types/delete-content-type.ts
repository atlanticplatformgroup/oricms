import type { Prisma } from '@prisma/client';
import { PLUGIN_EVENT_NAMES, type ContentType } from '@ori/shared';
import { dispatchLifecycleEvent } from '../../plugins/dispatcher';
import { dispatchPluginHook } from '../../plugins/hook-dispatcher';
import { apiServices } from '../../lib/api-services';
import { prisma } from '../../lib/prisma';
import type { ContentTypeMutationContext, ContentTypeMutationDeps, ContentTypeMutationOptions } from './types';
import { queueDeliveryProjectionReconcile } from '../../delivery-projection/shared';

function getAuthor(actor: ContentTypeMutationContext['actor']) {
  return {
    name: actor.name || 'Unknown',
    email: actor.email || 'unknown@example.com',
  };
}

export async function deleteContentType(
  context: ContentTypeMutationContext,
  contentType: ContentType,
  options: ContentTypeMutationOptions,
  deps: ContentTypeMutationDeps,
): Promise<{ path: string }> {
  const path = `schemas/types/${contentType.name}.json`;
  const prismaClient = deps.prismaClient ?? prisma;
  const pluginDispatcher = deps.dispatchPluginHook ?? dispatchPluginHook;
  const deleteRecords = options.deleteRecords === true;

  await dispatchLifecycleEvent('contentType.beforeDelete', {
    projectId: context.projectId,
    typeId: contentType.name,
    actor: context.actor,
    path,
    deleteRecords,
  });

  await dispatchLifecycleEvent('schema.beforeDelete', {
    projectId: context.projectId,
    path,
    actor: context.actor,
  });

  if (deleteRecords) {
    const files = await deps.gitService.listFiles(context.projectId, `content/${contentType.name}`, undefined, true).catch(() => []);
    const deleteTargets = [
      { path, content: '', action: 'delete' as const },
      ...files.filter((file) => file.type === 'file').map((file) => ({ path: file.path, content: '', action: 'delete' as const })),
    ];

    await deps.gitService.writeFilesBatch(context.projectId, deleteTargets, {
      message: `Delete content type: ${contentType.name}`,
      author: getAuthor(context.actor),
    });
  } else {
    await deps.gitService.deleteFile(context.projectId, path, {
      message: `Delete content type: ${contentType.name}`,
      author: getAuthor(context.actor),
    });
  }

  await dispatchLifecycleEvent('schema.afterDelete', {
    projectId: context.projectId,
    path,
    actor: context.actor,
  });

  await dispatchLifecycleEvent('contentType.afterDelete', {
    projectId: context.projectId,
    typeId: contentType.name,
    actor: context.actor,
    path,
    deleteRecords,
  });

  if (options.audit) {
    await prismaClient.auditLog.create({
      data: {
        projectId: context.projectId,
        userId: options.audit.userId,
        action: options.audit.action,
        resourceType: 'contentType',
        resourceId: contentType.name,
        oldValue: contentType as unknown as Prisma.InputJsonValue,
      },
    });
  }

  apiServices.runBackgroundTask(
    'plugin-hook:content-type-delete',
    pluginDispatcher({
      projectId: context.projectId,
      event: PLUGIN_EVENT_NAMES.CONTENT_TYPE_DELETED,
      resourceType: 'contentType',
      resourceId: contentType.name,
      payload: { typeId: contentType.name, path, deleteRecords },
      actor: context.actor,
    }),
  );

  queueDeliveryProjectionReconcile({
    projectId: context.projectId,
    label: 'delivery-projection:content-type-delete',
  });

  return { path };
}
