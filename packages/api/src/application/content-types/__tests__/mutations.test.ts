import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLUGIN_EVENT_NAMES } from '@ori/shared';

const {
  writeFileMock,
  deleteFileMock,
  writeFilesBatchMock,
  listFilesMock,
  auditCreateMock,
  dispatchLifecycleEventMock,
  dispatchPluginHookMock,
  lifecycleHookErrorClass,
} = vi.hoisted(() => ({
  writeFileMock: vi.fn(),
  deleteFileMock: vi.fn(),
  writeFilesBatchMock: vi.fn(),
  listFilesMock: vi.fn(),
  auditCreateMock: vi.fn(),
  dispatchLifecycleEventMock: vi.fn(),
  dispatchPluginHookMock: vi.fn(),
  lifecycleHookErrorClass: class LifecycleHookError extends Error {},
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

import { createContentType } from '../create-content-type';
import { updateContentType } from '../update-content-type';
import { deleteContentType } from '../delete-content-type';

describe('content type application services', () => {
  const context = {
    projectId: 'project-1',
    actor: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
    },
  };

  const contentType = {
    $schema: 'content-type-v1' as const,
    $id: 'post',
    name: 'post',
    plural: 'posts',
    label: 'Post',
    labelPlural: 'Posts',
    fields: [{ key: 'title', label: 'Title', type: 'string' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    writeFileMock.mockResolvedValue(undefined);
    deleteFileMock.mockResolvedValue(undefined);
    writeFilesBatchMock.mockResolvedValue(undefined);
    listFilesMock.mockResolvedValue([{ path: 'content/post/hello-world.json', type: 'file' }]);
    auditCreateMock.mockResolvedValue({});
    dispatchLifecycleEventMock.mockResolvedValue(undefined);
    dispatchPluginHookMock.mockResolvedValue(undefined);
  });

  it('creates a content type and dispatches lifecycle/plugin hooks', async () => {
    const result = await createContentType(context, contentType, {
      audit: { userId: 'user-1', action: 'contentType.create' },
    }, {
      gitService: { writeFile: writeFileMock, deleteFile: deleteFileMock, writeFilesBatch: writeFilesBatchMock, listFiles: listFilesMock },
    });

    expect(result.path).toBe('schemas/types/post.json');
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('contentType.beforeCreate', expect.objectContaining({ typeId: 'post' }));
    expect(writeFileMock).toHaveBeenCalledWith('project-1', 'schemas/types/post.json', expect.stringContaining('"name": "post"'), expect.objectContaining({ message: 'Create content type: Post' }));
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('contentType.afterCreate', expect.objectContaining({ typeId: 'post' }));
    expect(dispatchPluginHookMock).toHaveBeenCalledWith(expect.objectContaining({ event: PLUGIN_EVENT_NAMES.CONTENT_TYPE_CREATED }));
  });

  it('lets beforeCreate block content type creation', async () => {
    dispatchLifecycleEventMock.mockRejectedValueOnce(new lifecycleHookErrorClass('blocked'));

    await expect(createContentType(context, contentType, {}, {
      gitService: { writeFile: writeFileMock, deleteFile: deleteFileMock, writeFilesBatch: writeFilesBatchMock, listFiles: listFilesMock },
    })).rejects.toThrow('blocked');
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('updates a content type and dispatches lifecycle/plugin hooks', async () => {
    await updateContentType(context, { ...contentType, label: 'Article' }, {
      audit: { userId: 'user-1', action: 'contentType.update' },
    }, {
      gitService: { writeFile: writeFileMock, deleteFile: deleteFileMock, writeFilesBatch: writeFilesBatchMock, listFiles: listFilesMock },
    });

    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('contentType.beforeUpdate', expect.objectContaining({ typeId: 'post' }));
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('contentType.afterUpdate', expect.objectContaining({ typeId: 'post' }));
    expect(dispatchPluginHookMock).toHaveBeenCalledWith(expect.objectContaining({ event: PLUGIN_EVENT_NAMES.CONTENT_TYPE_UPDATED }));
  });

  it('deletes a content type and records in batch when requested', async () => {
    await deleteContentType(context, contentType, {
      deleteRecords: true,
      audit: { userId: 'user-1', action: 'contentType.delete' },
    }, {
      gitService: { writeFile: writeFileMock, deleteFile: deleteFileMock, writeFilesBatch: writeFilesBatchMock, listFiles: listFilesMock },
    });

    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('contentType.beforeDelete', expect.objectContaining({ typeId: 'post', deleteRecords: true }));
    expect(writeFilesBatchMock).toHaveBeenCalled();
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('contentType.afterDelete', expect.objectContaining({ typeId: 'post', deleteRecords: true }));
    expect(dispatchPluginHookMock).toHaveBeenCalledWith(expect.objectContaining({ event: PLUGIN_EVENT_NAMES.CONTENT_TYPE_DELETED }));
  });
});
