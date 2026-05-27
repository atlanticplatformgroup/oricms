import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useWorkspaceShellMode } from '../useWorkspaceShellMode';

describe('useWorkspaceShellMode', () => {
  let innerWidth = 1280;
  const listeners = new Map<string, Array<(event: Event) => void>>();

  beforeEach(() => {
    innerWidth = 1280;
    listeners.clear();

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      get: () => innerWidth,
      set: (v: number) => { innerWidth = v; },
    });

    vi.spyOn(window, 'addEventListener').mockImplementation((type: string, handler: EventListenerOrEventListenerObject) => {
      const list = listeners.get(type) || [];
      list.push(handler as (event: Event) => void);
      listeners.set(type, list);
    });

    vi.spyOn(window, 'removeEventListener').mockImplementation((type: string, handler: EventListenerOrEventListenerObject) => {
      const list = listeners.get(type) || [];
      listeners.set(type, list.filter((h) => h !== handler));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });
  });

  function fireResize(width: number) {
    innerWidth = width;
    const resizeListeners = listeners.get('resize') || [];
    resizeListeners.forEach((handler) => handler(new Event('resize')));
  }

  it('returns wide mode for large viewports', () => {
    innerWidth = 1400;
    const { result } = renderHook(() => useWorkspaceShellMode());
    expect(result.current.shellMode).toBe('wide');
    expect(result.current.isWideShell).toBe(true);
    expect(result.current.isMobileShell).toBe(false);
  });

  it('returns narrow mode for medium viewports', () => {
    innerWidth = 1000;
    const { result } = renderHook(() => useWorkspaceShellMode());
    expect(result.current.shellMode).toBe('narrow');
    expect(result.current.isNarrowShell).toBe(true);
  });

  it('returns mobile mode for small viewports', () => {
    innerWidth = 600;
    const { result } = renderHook(() => useWorkspaceShellMode());
    expect(result.current.shellMode).toBe('mobile');
    expect(result.current.isMobileShell).toBe(true);
  });

  it('updates mode on window resize', () => {
    innerWidth = 1400;
    const { result } = renderHook(() => useWorkspaceShellMode());
    expect(result.current.shellMode).toBe('wide');

    act(() => {
      fireResize(1000);
    });

    expect(result.current.shellMode).toBe('narrow');

    act(() => {
      fireResize(800);
    });

    expect(result.current.shellMode).toBe('mobile');
  });

  it('registers and unregisters resize listener', () => {
    const { unmount } = renderHook(() => useWorkspaceShellMode());
    expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));

    unmount();
    expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
