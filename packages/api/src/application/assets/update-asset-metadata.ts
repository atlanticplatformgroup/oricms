import type { Prisma } from '@prisma/client';
import { PLUGIN_EVENT_NAMES, type AssetMetadata } from '@ori/shared';
import { dispatchLifecycleEvent } from '../../plugins/dispatcher';
import { dispatchPluginHook } from '../../plugins/hook-dispatcher';
import { apiServices } from '../../lib/api-services';
import { prisma } from '../../lib/prisma';
import { getPrismaErrorResponse } from '../../lib/prisma';
import type { AssetMutationContext, AssetMutationDeps, AssetMutationOptions, AssetMutationResult } from './types';

function getAuthor(actor: AssetMutationContext['actor']) {
  return {
    name: actor.name || 'Unknown',
    email: actor.email || 'unknown@example.com',
  };
}

export async function updateAssetMetadata(
  context: AssetMutationContext,
  assetPath: string,
  metadata: AssetMetadata,
  options: AssetMutationOptions,
  deps: AssetMutationDeps,
): Promise<AssetMutationResult> {
  const prismaClient = deps.prismaClient ?? prisma;
  const pluginDispatcher = deps.dispatchPluginHook ?? dispatchPluginHook;

  await dispatchLifecycleEvent('asset.beforeUpdate', {
    projectId: context.projectId,
    assetPath,
    actor: context.actor,
    metadata: metadata as Record<string, unknown>,
  });

  const updated = await deps.assetService.updateMetadata(context.projectId, assetPath, metadata, {
    author: getAuthor(context.actor),
    message: `Update metadata for ${assetPath.split('/').pop()}`,
  });

  await dispatchLifecycleEvent('asset.afterUpdate', {
    projectId: context.projectId,
    assetPath,
    actor: context.actor,
    metadata: updated as Record<string, unknown>,
  });

  if (options.audit) {
    try {
      await prismaClient.auditLog.create({
        data: {
          projectId: context.projectId,
          userId: options.audit.userId,
          action: options.audit.action,
          resourceType: 'asset',
          resourceId: assetPath,
          newValue: updated as unknown as Prisma.InputJsonValue,
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

  apiServices.runBackgroundTask(
    'plugin-hook:asset-update',
    pluginDispatcher({
      projectId: context.projectId,
      event: PLUGIN_EVENT_NAMES.ASSET_UPDATED,
      resourceType: 'asset',
      resourceId: assetPath,
      payload: { assetPath, metadata: updated },
      actor: context.actor,
    }),
  );

  return { metadata: updated, assetPath };
}
