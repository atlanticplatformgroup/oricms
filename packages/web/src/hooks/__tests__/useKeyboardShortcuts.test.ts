import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useKeyboardShortcuts, formatShortcut, DEFAULT_SHORTCUTS } from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts helpers', () => {
  describe('formatShortcut', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');

    afterEach(() => {
      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform);
      }
    });

    it('formats shortcuts for Windows/Linux', () => {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        get: () => 'Win32',
      });

      expect(formatShortcut('Ctrl+S')).toBe('Ctrl S');
      expect(formatShortcut('Alt+Shift+F')).toBe('Alt Shift F');
    });

    it('formats shortcuts for macOS', () => {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        get: () => 'MacIntel',
      });

      expect(formatShortcut('Ctrl+S')).toBe('⌘ S');
      expect(formatShortcut('Alt+F')).toBe('⌥ F');
      expect(formatShortcut('Shift+X')).toBe('⇧ X');
      expect(formatShortcut('Cmd+K')).toBe('⌘ K');
    });
  });

  describe('DEFAULT_SHORTCUTS', () => {
    it('has navigation shortcuts', () => {
      const nav = DEFAULT_SHORTCUTS.find((c) => c.name === 'Navigation');
      expect(nav).toBeDefined();
      expect(nav!.shortcuts.length).toBeGreaterThan(0);
    });
  });
});

describe('useKeyboardShortcuts hook', () => {
  beforeEach(() => {
    vi.spyOn(window, 'addEventListener').mockImplementation(vi.fn() as unknown as typeof window.addEventListener);
    vi.spyOn(window, 'removeEventListener').mockImplementation(vi.fn() as unknown as typeof window.removeEventListener);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers keydown listener on mount', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+s': handler }));

    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('removes keydown listener on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ 'ctrl+s': handler }));

    unmount();
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('does not call handler when disabled', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+s': handler }, { enabled: false }));

    const addListenerCalls = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
    const keydownCalls = addListenerCalls.filter((call: unknown[]) => call[0] === 'keydown');
    expect(keydownCalls.length).toBe(1);

    const keydownHandler = keydownCalls[0][1] as (e: KeyboardEvent) => void;
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    keydownHandler(event);
    expect(handler).not.toHaveBeenCalled();
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});
