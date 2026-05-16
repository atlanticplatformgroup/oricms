import { describe, expect, it } from 'vitest';
import { PresenceRoomStore, getPresenceRoomKey } from '../presence-store';

describe('PresenceRoomStore', () => {
  it('joins a room and reports the current room presence', () => {
    const store = new PresenceRoomStore();

    const result = store.join({
      socketId: 'socket-1',
      user: { id: 'user-1', name: 'Ada' },
      projectId: 'project-1',
      page: '/collections/posts',
      action: 'viewing',
    });

    expect(result).toEqual({
      kind: 'joined',
      roomKey: 'project-1:/collections/posts',
      user: { id: 'user-1', name: 'Ada', action: 'viewing' },
      otherUsers: [],
      leftRoom: undefined,
    });
    expect(store.getPresence('project-1', '/collections/posts')).toEqual({
      users: [{ id: 'user-1', name: 'Ada', action: 'viewing' }],
    });
  });

  it('updates action in-place when rejoining the same room and tracks action changes', () => {
    const store = new PresenceRoomStore();
    store.join({
      socketId: 'socket-1',
      user: { id: 'user-1', name: 'Ada' },
      projectId: 'project-1',
      page: '/collections/posts',
      action: 'viewing',
    });

    expect(
      store.join({
        socketId: 'socket-1',
        user: { id: 'user-1', name: 'Ada' },
        projectId: 'project-1',
        page: '/collections/posts',
        action: 'editing',
      }),
    ).toEqual({
      kind: 'updated',
      roomKey: 'project-1:/collections/posts',
      user: { id: 'user-1', name: 'Ada', action: 'editing' },
    });

    expect(store.changeAction('socket-1', 'viewing')).toEqual({
      roomKey: 'project-1:/collections/posts',
      page: '/collections/posts',
      user: { id: 'user-1', name: 'Ada', action: 'viewing' },
    });
  });

  it('moves a socket between rooms and exposes the left-room transition', () => {
    const store = new PresenceRoomStore();
    store.join({
      socketId: 'socket-1',
      user: { id: 'user-1', name: 'Ada' },
      projectId: 'project-1',
      page: '/collections/posts',
      action: 'viewing',
    });
    store.join({
      socketId: 'socket-2',
      user: { id: 'user-2', name: 'Grace' },
      projectId: 'project-1',
      page: '/collections/pages',
      action: 'editing',
    });

    expect(
      store.join({
        socketId: 'socket-1',
        user: { id: 'user-1', name: 'Ada' },
        projectId: 'project-1',
        page: '/collections/pages',
        action: 'editing',
      }),
    ).toEqual({
      kind: 'joined',
      roomKey: 'project-1:/collections/pages',
      user: { id: 'user-1', name: 'Ada', action: 'editing' },
      otherUsers: [{ id: 'user-2', name: 'Grace', action: 'editing' }],
      leftRoom: {
        roomKey: 'project-1:/collections/posts',
        page: '/collections/posts',
        user: { id: 'user-1', name: 'Ada', action: 'viewing' },
      },
    });

    expect(store.getPresence('project-1', '/collections/posts')).toEqual({ users: [] });
  });

  it('removes users on leave and exposes empty-room cleanup through presence reads', () => {
    const store = new PresenceRoomStore();
    store.join({
      socketId: 'socket-1',
      user: { id: 'user-1', name: 'Ada' },
      projectId: 'project-1',
      page: '/collections/posts',
      action: 'viewing',
    });

    expect(store.leave('socket-1')).toEqual({
      roomKey: 'project-1:/collections/posts',
      page: '/collections/posts',
      user: { id: 'user-1', name: 'Ada', action: 'viewing' },
    });
    expect(store.getPresence('project-1', '/collections/posts')).toEqual({ users: [] });
    expect(store.leave('socket-1')).toBeNull();
  });

  it('builds stable room keys', () => {
    expect(getPresenceRoomKey('project-1', '/editor/posts')).toBe('project-1:/editor/posts');
  });
});
