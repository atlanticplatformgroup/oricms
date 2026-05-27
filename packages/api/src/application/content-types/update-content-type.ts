import type { Prisma } from '@prisma/client';
import { PLUGIN_EVENT_NAMES, type ContentType } from '@ori/shared';
import { dispatchLifecycleEvent } from '../../plugins/dispatcher';
import { dispatchPluginHook } from '../../plugins/hook-dispatcher';
import { apiServices } from '../../lib/api-services';
import { prisma } from '../../lib/prisma';
import type { ContentTypeMutationContext, ContentTypeMutationDeps, ContentTypeMutationOptions, ContentTypeMutationResult } from './types';
import { queueDeliveryProjectionReconcile } from '../../delivery-projection/shared';

function getAuthor(actor: ContentTypeMutationContext['actor']) {
  return {
    name: actor.name || 'Unknown',
    email: actor.email || 'unknown@example.com',
  };
}

export async function updateContentType(
  context: ContentTypeMutationContext,
  contentType: ContentType,
  options: ContentTypeMutationOptions,
  deps: ContentTypeMutationDeps,
): Promise<ContentTypeMutationResult> {
  const path = `schemas/types/${contentType.name}.json`;
  const content = `${JSON.stringify(contentType, null, 2)}\n`;
  const prismaClient = deps.prismaClient ?? prisma;
  const pluginDispatcher = deps.dispatchPluginHook ?? dispatchPluginHook;

  await dispatchLifecycleEvent('contentType.beforeUpdate', {
    projectId: context.projectId,
    typeId: contentType.name,
    actor: context.actor,
    contentType: contentType as unknown as Record<string, unknown>,
    path,
  });

  await dispatchLifecycleEvent('schema.beforeSave', {
    projectId: context.projectId,
    path,
    actor: context.actor,
    content,
  });

  await deps.gitService.writeFile(context.projectId, path, content, {
    message: `Update content type: ${contentType.label}`,
    author: getAuthor(context.actor),
  });

  await dispatchLifecycleEvent('schema.afterSave', {
    projectId: context.projectId,
    path,
    actor: context.actor,
    content,
  });

  await dispatchLifecycleEvent('contentType.afterUpdate', {
    projectId: context.projectId,
    typeId: contentType.name,
    actor: context.actor,
    contentType: contentType as unknown as Record<string, unknown>,
    path,
  });

  if (options.audit) {
    await prismaClient.auditLog.create({
      data: {
        projectId: context.projectId,
        userId: options.audit.userId,
        action: options.audit.action,
        resourceType: 'contentType',
        resourceId: contentType.name,
        newValue: contentType as unknown as Prisma.InputJsonValue,
      },
    });
  }

  apiServices.runBackgroundTask(
    'plugin-hook:content-type-update',
    pluginDispatcher({
      projectId: context.projectId,
      event: PLUGIN_EVENT_NAMES.CONTENT_TYPE_UPDATED,
      resourceType: 'contentType',
      resourceId: contentType.name,
      payload: { typeId: contentType.name, path },
      actor: context.actor,
    }),
  );

  queueDeliveryProjectionReconcile({
    projectId: context.projectId,
    label: 'delivery-projection:content-type-update',
  });

  return { path, contentType };
}
