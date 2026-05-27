import { dispatchLifecycleEvent } from '../../plugins/dispatcher';
import { getPrismaErrorResponse } from '../../lib/prisma';
import type { SchemaMutationContext, SchemaMutationDeps } from './types';

export async function deleteSchema(
  context: SchemaMutationContext,
  deps: SchemaMutationDeps,
): Promise<{ path: string }> {
  await dispatchLifecycleEvent('schema.beforeDelete', {
    projectId: context.projectId,
    path: context.path,
    actor: context.actor,
  });

  try {
    await deps.gitService.deleteFile(context.projectId, context.path, {
      message: `Delete schema ${context.path}`,
      author: {
        name: context.actor.name || 'Unknown',
        email: context.actor.email || 'unknown@example.com',
      },
    });
  } catch (error) {
    const prismaError = getPrismaErrorResponse(error);
    if (prismaError) {
      throw Object.assign(new Error(prismaError.message), { statusCode: prismaError.statusCode, code: prismaError.code });
    }
    throw error;
  }

  await dispatchLifecycleEvent('schema.afterDelete', {
    projectId: context.projectId,
    path: context.path,
    actor: context.actor,
  });

  return { path: context.path };
}
