import { PLUGIN_EVENT_NAMES } from '@ori/shared';
import { dispatchLifecycleEvent } from '../../plugins/dispatcher';
import { dispatchPluginHook } from '../../plugins/hook-dispatcher';
import { apiServices } from '../../lib/api-services';
import { prisma } from '../../lib/prisma';
import type { AssetMutationContext, AssetMutationDeps, AssetMutationOptions, AssetMutationResult } from './types';

function getAuthor(actor: AssetMutationContext['actor']) {
  return {
    name: actor.name || 'Unknown',
    email: actor.email || 'unknown@example.com',
  };
}

export async function deleteAsset(
  context: AssetMutationContext,
  assetPath: string,
  options: AssetMutationOptions,
  deps: AssetMutationDeps,
): Promise<AssetMutationResult> {
  const prismaClient = deps.prismaClient ?? prisma;
  const pluginDispatcher = deps.dispatchPluginHook ?? dispatchPluginHook;

  await dispatchLifecycleEvent('asset.beforeDelete', {
    projectId: context.projectId,
    assetPath,
    actor: context.actor,
  });

  await deps.assetService.deleteAsset(context.projectId, assetPath, {
    author: getAuthor(context.actor),
    message: `Delete ${assetPath.split('/').pop()}`,
  });

  await dispatchLifecycleEvent('asset.afterDelete', {
    projectId: context.projectId,
    assetPath,
    actor: context.actor,
  });

  if (options.audit) {
    await prismaClient.auditLog.create({
      data: {
        projectId: context.projectId,
        userId: options.audit.userId,
        action: options.audit.action,
        resourceType: 'asset',
        resourceId: assetPath,
      },
    });
  }

  apiServices.runBackgroundTask(
    'plugin-hook:asset-delete',
    pluginDispatcher({
      projectId: context.projectId,
      event: PLUGIN_EVENT_NAMES.ASSET_DELETED,
      resourceType: 'asset',
      resourceId: assetPath,
      payload: { assetPath },
      actor: context.actor,
    }),
  );

  return { assetPath };
}
