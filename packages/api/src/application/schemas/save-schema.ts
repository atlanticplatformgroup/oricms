import { dispatchLifecycleEvent } from '../../plugins/dispatcher';
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

  await deps.gitService.writeFile(context.projectId, context.path, content, {
    message: message || `Update ${context.path}`,
    author: {
      name: context.actor.name || 'Unknown',
      email: context.actor.email || 'unknown@example.com',
    },
  });

  await dispatchLifecycleEvent('schema.afterSave', {
    projectId: context.projectId,
    path: context.path,
    actor: context.actor,
    content,
  });

  return { path: context.path };
}
