import { beforeEach, describe, expect, it } from 'vitest';
import { clearLifecycleHooks, dispatchLifecycleEvent, LifecycleHookError, registerLifecycleHook } from '../dispatcher';

describe('lifecycle dispatcher', () => {
  beforeEach(() => {
    clearLifecycleHooks();
  });

  it('runs handlers in registration order', async () => {
    const seen: string[] = [];
    registerLifecycleHook('entry.beforeCreate', 'one', async () => { seen.push('one'); });
    registerLifecycleHook('entry.beforeCreate', 'two', async () => { seen.push('two'); });

    await dispatchLifecycleEvent('entry.beforeCreate', {
      projectId: 'project-1',
      collectionId: 'posts',
      data: {},
    });

    expect(seen).toEqual(['one', 'two']);
  });

  it('lets before hooks block by throwing', async () => {
    registerLifecycleHook('entry.beforeDelete', 'blocker', async () => {
      throw new LifecycleHookError('blocked');
    });

    await expect(dispatchLifecycleEvent('entry.beforeDelete', {
      projectId: 'project-1',
      collectionId: 'posts',
      entryId: 'hello-world',
    })).rejects.toThrow('blocked');
  });

  it('replaces handlers with the same id instead of accumulating', async () => {
    const seen: string[] = [];
    registerLifecycleHook('schema.afterSave', 'plugin-a', async () => { seen.push('first'); });
    registerLifecycleHook('schema.afterSave', 'plugin-a', async () => { seen.push('second'); });

    await dispatchLifecycleEvent('schema.afterSave', {
      projectId: 'project-1',
      path: 'schemas/types/post.json',
      content: '{}',
    });

    expect(seen).toEqual(['second']);
  });
});
