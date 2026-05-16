import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  dispatchLifecycleEventMock,
  lifecycleHookErrorClass,
} = vi.hoisted(() => ({
  dispatchLifecycleEventMock: vi.fn(),
  lifecycleHookErrorClass: class LifecycleHookError extends Error {},
}));

vi.mock('../../../plugins/dispatcher', () => ({
  dispatchLifecycleEvent: (...args: unknown[]) => dispatchLifecycleEventMock(...args),
  LifecycleHookError: lifecycleHookErrorClass,
}));

import { saveSchema } from '../save-schema';
import { deleteSchema } from '../delete-schema';

describe('schema application services', () => {
  const writeFile = vi.fn();
  const deleteFile = vi.fn();
  const context = {
    projectId: 'project-1',
    path: 'schemas/types/post.json',
    actor: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    writeFile.mockResolvedValue(undefined);
    deleteFile.mockResolvedValue(undefined);
    dispatchLifecycleEventMock.mockResolvedValue(undefined);
  });

  it('saves a schema and dispatches before/after events', async () => {
    const result = await saveSchema(context, '{"fields":[]}', 'Save schema', {
      gitService: { writeFile, deleteFile },
    });

    expect(result.path).toBe('schemas/types/post.json');
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('schema.beforeSave', expect.objectContaining({
      path: 'schemas/types/post.json',
      content: '{"fields":[]}',
    }));
    expect(writeFile).toHaveBeenCalledWith('project-1', 'schemas/types/post.json', '{"fields":[]}', expect.objectContaining({
      message: 'Save schema',
    }));
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('schema.afterSave', expect.objectContaining({
      path: 'schemas/types/post.json',
      content: '{"fields":[]}',
    }));
  });

  it('lets beforeSave block the mutation', async () => {
    dispatchLifecycleEventMock.mockRejectedValueOnce(new lifecycleHookErrorClass('blocked'));

    await expect(saveSchema(context, '{"fields":[]}', 'Save schema', {
      gitService: { writeFile, deleteFile },
    })).rejects.toThrow('blocked');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('deletes a schema and dispatches before/after events', async () => {
    const result = await deleteSchema(context, {
      gitService: { writeFile, deleteFile },
    });

    expect(result.path).toBe('schemas/types/post.json');
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('schema.beforeDelete', expect.objectContaining({
      path: 'schemas/types/post.json',
    }));
    expect(deleteFile).toHaveBeenCalledWith('project-1', 'schemas/types/post.json', expect.objectContaining({
      message: 'Delete schema schemas/types/post.json',
    }));
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('schema.afterDelete', expect.objectContaining({
      path: 'schemas/types/post.json',
    }));
  });
});
