import { dispatchLifecycleEvent } from '../../plugins/dispatcher';
import { getPrismaErrorResponse } from '../../lib/prisma';
import type { SchemaMutationContext, SchemaMutationDeps } from './types';

export async function saveSchema(
  context: SchemaMutationContext,
  content: string,
  message: string | undefined,
  deps: SchemaMutationDeps,
): Promise<{ path: string }> {
  await dispatchLifecycleEvent('schema.beforeSave', {
    projectId: context.projectId,
    path: context.path,
    actor: context.actor,
    content,
  });

  try {
    await deps.gitService.writeFile(context.projectId, context.path, content, {
      message: message || `Update ${context.path}`,
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

  await dispatchLifecycleEvent('schema.afterSave', {
    projectId: context.projectId,
    path: context.path,
    actor: context.actor,
    content,
  });

  return { path: context.path };
}
