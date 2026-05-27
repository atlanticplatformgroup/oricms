import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { usePresence } from '../usePresence';

interface MockSocket {
  on: (event: string, handler: (data: unknown) => void) => void;
  emit: (event: string, data?: unknown) => void;
  disconnect: () => void;
  _handlers: Record<string, Array<(data: unknown) => void>>;
}

let socketInstance: MockSocket | null = null;

const ioMock = vi.fn((_url: string, _options?: object): MockSocket => {
  const handlers: Record<string, Array<(data: unknown) => void>> = {};
  const socket: MockSocket = {
    on: (event: string, handler: (data: unknown) => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    },
    emit: () => {
      // outbound events — no-op for tests
    },
    disconnect: () => {
      // cleanup
    },
    _handlers: handlers,
  };
  socketInstance = socket;
  return socket;
});

vi.mock('socket.io-client', () => ({
  io: (...args: [string, object?]) => ioMock(...args),
}));

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

vi.mock('../../lib/api/core', () => ({
  API_BASE_URL: 'http://localhost:3001',
}));

describe('usePresence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketInstance = null;
  });

  function triggerSocketEvent(event: string, data: unknown) {
    if (!socketInstance) return;
    socketInstance._handlers[event]?.forEach((handler) => handler(data));
  }

  it('returns initial state', () => {
    const { result } = renderHook(() => usePresence('project-1', '/page-1'));

    expect(result.current.users).toEqual([]);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.currentUserAction).toBe('viewing');
  });

  it('does not connect when projectId is undefined', () => {
    renderHook(() => usePresence(undefined, '/page-1'));
    expect(ioMock).not.toHaveBeenCalled();
  });

  it('connects with token auth', () => {
    renderHook(() => usePresence('project-1', '/page-1'));

    expect(ioMock).toHaveBeenCalledWith('http://localhost:3001', expect.objectContaining({
      auth: { token: 'test-token' },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    }));
  });

  it('sets connected on connect event', () => {
    const { result } = renderHook(() => usePresence('project-1', '/page-1'));

    act(() => triggerSocketEvent('connect', undefined));

    expect(result.current.isConnected).toBe(true);
  });

  it('sets disconnected on disconnect event', () => {
    const { result } = renderHook(() => usePresence('project-1', '/page-1'));

    act(() => triggerSocketEvent('connect', undefined));
    expect(result.current.isConnected).toBe(true);

    act(() => triggerSocketEvent('disconnect', undefined));
    expect(result.current.isConnected).toBe(false);
  });

  it('receives room state', () => {
    const { result } = renderHook(() => usePresence('project-1', '/page-1'));

    act(() => triggerSocketEvent('presence:state', { users: [{ id: 'user-1', name: 'Alice', action: 'viewing' }] }));

    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].name).toBe('Alice');
  });

  it('adds user on joined event', () => {
    const { result } = renderHook(() => usePresence('project-1', '/page-1'));

    act(() => triggerSocketEvent('presence:state', { users: [{ id: 'user-1', name: 'Alice', action: 'viewing' }] }));
    act(() => triggerSocketEvent('presence:joined', { user: { id: 'user-2', name: 'Bob', action: 'editing' } }));

    expect(result.current.users).toHaveLength(2);
    expect(result.current.users[1].name).toBe('Bob');
  });

  it('does not duplicate existing user on joined', () => {
    const { result } = renderHook(() => usePresence('project-1', '/page-1'));

    act(() => triggerSocketEvent('presence:state', { users: [{ id: 'user-1', name: 'Alice', action: 'viewing' }] }));
    act(() => triggerSocketEvent('presence:joined', { user: { id: 'user-1', name: 'Alice', action: 'editing' } }));

    expect(result.current.users).toHaveLength(1);
  });

  it('removes user on left event', () => {
    const { result } = renderHook(() => usePresence('project-1', '/page-1'));

    act(() => triggerSocketEvent('presence:state', { users: [{ id: 'user-1', name: 'Alice', action: 'viewing' }] }));
    act(() => triggerSocketEvent('presence:left', { user: { id: 'user-1' } }));

    expect(result.current.users).toHaveLength(0);
  });

  it('updates user action', () => {
    const { result } = renderHook(() => usePresence('project-1', '/page-1'));

    act(() => triggerSocketEvent('presence:state', { users: [{ id: 'user-1', name: 'Alice', action: 'viewing' }] }));
    act(() => triggerSocketEvent('presence:action', { user: { id: 'user-1', name: 'Alice', action: 'editing' } }));

    expect(result.current.users[0].action).toBe('editing');
  });

  it('updateAction changes current action and emits', () => {
    const { result } = renderHook(() => usePresence('project-1', '/page-1'));

    act(() => result.current.updateAction('editing'));

    expect(result.current.currentUserAction).toBe('editing');
  });

  it('emitContentUpdate does nothing without projectId', () => {
    const { result } = renderHook(() => usePresence(undefined, '/page-1'));

    act(() => result.current.emitContentUpdate('coll-1', 'entry-1', { title: 'New' }));

    expect(ioMock).not.toHaveBeenCalled();
  });
});
