import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  initMock,
  listCollectionsMock,
  saveCollectionsMock,
  deleteCollectionMock,
  dispatchLifecycleEventMock,
  dispatchPluginHookMock,
  lifecycleHookErrorClass,
  seedAgentWriteConfigsForProjectAgentsMock,
} = vi.hoisted(() => ({
  initMock: vi.fn(),
  listCollectionsMock: vi.fn(),
  saveCollectionsMock: vi.fn(),
  deleteCollectionMock: vi.fn(),
  dispatchLifecycleEventMock: vi.fn(),
  dispatchPluginHookMock: vi.fn(),
  lifecycleHookErrorClass: class LifecycleHookError extends Error {},
  seedAgentWriteConfigsForProjectAgentsMock: vi.fn(),
}));

vi.mock('../../../collections/service', () => ({
  CollectionService: vi.fn().mockImplementation(() => ({
    init: initMock,
    listCollections: listCollectionsMock,
    saveCollections: saveCollectionsMock,
    deleteCollection: deleteCollectionMock,
  })),
}));

vi.mock('../../../plugins/dispatcher', () => ({
  dispatchLifecycleEvent: (...args: unknown[]) => dispatchLifecycleEventMock(...args),
  LifecycleHookError: lifecycleHookErrorClass,
}));

vi.mock('../../../plugins/hook-dispatcher', () => ({
  dispatchPluginHook: (...args: unknown[]) => dispatchPluginHookMock(...args),
}));

vi.mock('../../../projects/agent-write-configs', () => ({
  seedAgentWriteConfigsForProjectAgents: (...args: unknown[]) => seedAgentWriteConfigsForProjectAgentsMock(...args),
}));

import { saveCollectionsConfig } from '../save-collections-config';
import { deleteCollection } from '../delete-collection';

describe('collection application services', () => {
  const context = {
    projectId: 'project-1',
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
    listCollectionsMock.mockResolvedValue([{ id: 'posts', label: 'Posts', contentType: 'post', path: 'content/posts' }]);
    saveCollectionsMock.mockResolvedValue(undefined);
    deleteCollectionMock.mockResolvedValue(undefined);
    dispatchLifecycleEventMock.mockResolvedValue(undefined);
    dispatchPluginHookMock.mockResolvedValue(undefined);
    seedAgentWriteConfigsForProjectAgentsMock.mockResolvedValue(0);
  });

  it('dispatches create lifecycle events for newly added collections', async () => {
    const result = await saveCollectionsConfig(context, [
      { id: 'posts', label: 'Posts', contentType: 'post', path: 'content/posts' },
      { id: 'pages', label: 'Pages', contentType: 'page', path: 'content/pages' },
    ]);

    expect(result.createdCollections).toHaveLength(1);
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('collection.beforeCreate', expect.objectContaining({
      collectionId: 'pages',
    }));
    expect(saveCollectionsMock).toHaveBeenCalled();
    expect(seedAgentWriteConfigsForProjectAgentsMock).toHaveBeenCalledWith({
      projectId: 'project-1',
      collectionNames: ['pages'],
      existingCollectionNames: ['posts'],
      targetBranch: 'main',
    });
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('collection.afterCreate', expect.objectContaining({
      collectionId: 'pages',
    }));
  });

  it('lets beforeCreate block collection config persistence', async () => {
    dispatchLifecycleEventMock.mockRejectedValueOnce(new lifecycleHookErrorClass('blocked'));

    await expect(saveCollectionsConfig(context, [
      { id: 'posts', label: 'Posts', contentType: 'post', path: 'content/posts' },
      { id: 'pages', label: 'Pages', contentType: 'page', path: 'content/pages' },
    ])).rejects.toThrow('blocked');
    expect(saveCollectionsMock).not.toHaveBeenCalled();
  });

  it('deletes a collection and dispatches lifecycle/plugin hooks', async () => {
    await deleteCollection(context, 'posts');

    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('collection.beforeDelete', expect.objectContaining({
      collectionId: 'posts',
    }));
    expect(deleteCollectionMock).toHaveBeenCalledWith('posts', {
      name: 'Test User',
      email: 'test@example.com',
    });
    expect(dispatchLifecycleEventMock).toHaveBeenCalledWith('collection.afterDelete', expect.objectContaining({
      collectionId: 'posts',
    }));
    expect(dispatchPluginHookMock).toHaveBeenCalledWith(expect.objectContaining({
      event: 'collection.deleted',
      resourceId: 'posts',
    }));
  });
});
