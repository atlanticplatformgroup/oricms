import { dispatchLifecycleEvent } from '../../plugins/dispatcher';
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

  await deps.gitService.deleteFile(context.projectId, context.path, {
    message: `Delete schema ${context.path}`,
    author: {
      name: context.actor.name || 'Unknown',
      email: context.actor.email || 'unknown@example.com',
    },
  });

  await dispatchLifecycleEvent('schema.afterDelete', {
    projectId: context.projectId,
    path: context.path,
    actor: context.actor,
  });

  return { path: context.path };
}
