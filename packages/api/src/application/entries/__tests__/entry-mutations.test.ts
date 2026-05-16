import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  initMock,
  createMock,
  updateMock,
  deleteMock,
  auditCreateMock,
  dispatchLifecycleEventMock,
  dispatchPluginHookMock,
  lifecycleHookErrorClass,
} = vi.hoisted(() => ({
  initMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  auditCreateMock: vi.fn(),
  dispatchLifecycleEventMock: vi.fn(),
  dispatchPluginHookMock: vi.fn(),
  lifecycleHookErrorClass: class LifecycleHookError extends Error {},
}));

vi.mock('../../../collections/service', () => ({
  CollectionService: vi.fn().mockImplementation(() => ({
    init: initMock,
    create: createMock,
    update: updateMock,
    delete: deleteMock,
  })),
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: auditCreateMock,
    },
  },
}));

vi.mock('../../../plugins/dispatcher', () => ({
  dispatchLifecycleEvent: (...args: unknown[]) => dispatchLifecycleEventMock(...args),
  LifecycleHookError: lifecycleHookErrorClass,
}));

vi.mock('../../../plugins/hook-dispatcher', () => ({
  dispatchPluginHook: (...args: unknown[]) => dispatchPluginHookMock(...args),
}));

import { createEntry } from '../create-entry';
import { updateEntry } from '../update-entry';
import { deleteEntry } from '../delete-entry';

describe('entry application services', () => {
  const context = {
    projectId: 'project-1',
    collectionId: 'posts',
    repoUrl: 'https://example.com/repo.git',
    branch: 'main',
    actor: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    initMock.mockResolvedValue(undefined);
    createMock.mockResolvedValue({ entry: { $id: 'hello-world', title: 'Hello World' }, revision: 'rev-create' });
    updateMock.mockResolvedValue({ entry: { $id: 'hello-world', title: 'Updated' }, revision: 'rev-update' });
    deleteMock.mockResolvedValue({ previousEntry: { $id: 'hello-world', title: 'Updated' }, revision: 'rev-delete' });
    auditCreateMock.mockResolvedValue({});
    dispatchLifecycleEventMock.mockResolvedValue(undefined);
    dispatchPluginHookMock.mockResolvedValue(undefined);
  });

  it('creates an entry and dispatches before/after lifecycle hooks', async () => {
    const result = await createEntry(context, { title: 'Hello World' }, {
      audit: { userId: 'user-1', action: 'collection.record.created' },
      plugin: { event: 'collection.record.created' },
    });

    expect(result.entryId).toBe('hello-world');
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('entry.beforeCreate', expect.objectContaining({
      projectId: 'project-1',
      collectionId: 'posts',
      data: { title: 'Hello World' },
    }));
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('entry.afterCreate', expect.objectContaining({
      projectId: 'project-1',
      collectionId: 'posts',
      entryId: 'hello-world',
    }));
    expect(auditCreateMock).toHaveBeenCalled();
    expect(dispatchPluginHookMock).toHaveBeenCalledWith(expect.objectContaining({
      event: 'collection.record.created',
      resourceId: 'posts:hello-world',
    }));
  });

  it('lets beforeCreate block the mutation', async () => {
    dispatchLifecycleEventMock.mockRejectedValueOnce(new lifecycleHookErrorClass('blocked'));

    await expect(createEntry(context, { title: 'Hello World' })).rejects.toThrow('blocked');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('updates an entry and dispatches lifecycle hooks', async () => {
    const result = await updateEntry(context, 'hello-world', { title: 'Updated' }, {
      audit: { userId: 'user-1', action: 'collection.record.updated' },
      plugin: { event: 'collection.record.updated' },
    });

    expect(result.entryId).toBe('hello-world');
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('entry.beforeUpdate', expect.objectContaining({
      entryId: 'hello-world',
      data: { title: 'Updated' },
    }));
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('entry.afterUpdate', expect.objectContaining({
      entryId: 'hello-world',
    }));
    expect(auditCreateMock).toHaveBeenCalled();
    expect(dispatchPluginHookMock).toHaveBeenCalledWith(expect.objectContaining({
      event: 'collection.record.updated',
      resourceId: 'posts:hello-world',
    }));
  });

  it('deletes an entry and dispatches lifecycle hooks', async () => {
    const result = await deleteEntry(context, 'hello-world', {
      audit: { userId: 'user-1', action: 'collection.record.deleted' },
      plugin: { event: 'collection.record.deleted' },
    });

    expect(result.entryId).toBe('hello-world');
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('entry.beforeDelete', expect.objectContaining({
      entryId: 'hello-world',
    }));
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('entry.afterDelete', expect.objectContaining({
      entryId: 'hello-world',
    }));
    expect(auditCreateMock).toHaveBeenCalled();
    expect(dispatchPluginHookMock).toHaveBeenCalledWith(expect.objectContaining({
      event: 'collection.record.deleted',
      resourceId: 'posts:hello-world',
    }));
  });
});
