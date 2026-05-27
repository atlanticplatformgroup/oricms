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

export async function uploadAsset(
  context: AssetMutationContext,
  input: { folder: string; filename: string; content: string; metadata?: AssetMetadata },
  options: AssetMutationOptions,
  deps: AssetMutationDeps,
): Promise<AssetMutationResult> {
  const prismaClient = deps.prismaClient ?? prisma;
  const pluginDispatcher = deps.dispatchPluginHook ?? dispatchPluginHook;
  const assetPath = `assets/${input.folder}/${input.filename}`;

  await dispatchLifecycleEvent('asset.beforeCreate', {
    projectId: context.projectId,
    assetPath,
    actor: context.actor,
    folder: input.folder,
    filename: input.filename,
  });

  const asset = await deps.assetService.uploadAsset(context.projectId, input.folder, input.filename, input.content, input.metadata, {
    author: getAuthor(context.actor),
    message: `Upload ${input.filename}`,
  });

  await dispatchLifecycleEvent('asset.afterCreate', {
    projectId: context.projectId,
    assetPath: asset.path,
    actor: context.actor,
    asset: asset as unknown as Record<string, unknown>,
  });

  if (options.audit) {
    try {
      await prismaClient.auditLog.create({
        data: {
          projectId: context.projectId,
          userId: options.audit.userId,
          action: options.audit.action,
          resourceType: 'asset',
          resourceId: asset.path,
          newValue: { filename: input.filename, size: asset.size } as unknown as Prisma.InputJsonValue,
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
    'plugin-hook:asset-create',
    pluginDispatcher({
      projectId: context.projectId,
      event: PLUGIN_EVENT_NAMES.ASSET_CREATED,
      resourceType: 'asset',
      resourceId: asset.path,
      payload: { assetPath: asset.path, folder: input.folder, filename: input.filename },
      actor: context.actor,
    }),
  );

  return { asset, assetPath: asset.path };
}
