import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { DarkModeProvider } from '../DarkModeContext';
import { useDarkMode } from '../useDarkMode';
import { UserPreferencesContext, type UserPreferencesContextType } from '../user-preferences-context';
import type { UserPreferences } from '@ori/shared';

const defaultPreferences: UserPreferences = {
  theme: 'light',
  editorMode: 'split',
  notifications: { builds: true, invites: true, mentions: true },
  projectDefaults: {},
  lastVisitedProjectId: null,
  onboarding: { version: 2, lastStep: 'welcome', completedAt: null, createdProjectId: null },
};

function createMockPreferencesContext(overrides: Partial<UserPreferencesContextType> = {}): UserPreferencesContextType {
  return {
    preferences: defaultPreferences,
    isLoading: false,
    updatePreferences: vi.fn(),
    updateProjectDefault: vi.fn(),
    setLastVisitedProject: vi.fn(),
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <UserPreferencesContext.Provider value={createMockPreferencesContext()}>
      <DarkModeProvider>{children}</DarkModeProvider>
    </UserPreferencesContext.Provider>
  );
}

describe('DarkModeContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    delete (document.documentElement.dataset as Record<string, string>).oriTheme;
  });

  it('throws when useDarkMode is used outside provider', () => {
    expect(() => renderHook(() => useDarkMode())).toThrow('useDarkMode must be used within a DarkModeProvider');
  });

  it('initializes light mode by default', () => {
    const { result } = renderHook(() => useDarkMode(), { wrapper });
    expect(result.current.isDarkMode).toBe(false);
    expect(result.current.theme).toBe('light');
  });

  it('toggles dark mode', () => {
    const { result } = renderHook(() => useDarkMode(), { wrapper });
    act(() => {
      result.current.toggleDarkMode();
    });
    expect(result.current.isDarkMode).toBe(true);
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.oriTheme).toBe('dark');
  });

  it('sets dark mode explicitly', () => {
    const { result } = renderHook(() => useDarkMode(), { wrapper });
    act(() => {
      result.current.setDarkMode(true);
    });
    expect(result.current.isDarkMode).toBe(true);
    act(() => {
      result.current.setDarkMode(false);
    });
    expect(result.current.isDarkMode).toBe(false);
  });

  it('sets theme to system and respects media query', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    const { result } = renderHook(() => useDarkMode(), { wrapper });
    act(() => {
      result.current.setTheme('system');
    });
    expect(result.current.theme).toBe('system');
    expect(result.current.isDarkMode).toBe(true);
  });

  it('syncs theme change to UserPreferencesContext when available', async () => {
    const updatePreferences = vi.fn();
    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <UserPreferencesContext.Provider value={createMockPreferencesContext({ updatePreferences })}>
        <DarkModeProvider>{children}</DarkModeProvider>
      </UserPreferencesContext.Provider>
    );
    const { result } = renderHook(() => useDarkMode(), { wrapper: customWrapper });
    act(() => {
      result.current.setTheme('dark');
    });
    await waitFor(() => expect(updatePreferences).toHaveBeenCalledWith({ theme: 'dark' }));
  });

  it('falls back to localStorage when UserPreferencesContext is unavailable', () => {
    vi.mocked(localStorage.setItem).mockImplementation(() => {});
    const fallbackWrapper = ({ children }: { children: React.ReactNode }) => (
      <UserPreferencesContext.Provider value={null as any}>
        <DarkModeProvider>{children}</DarkModeProvider>
      </UserPreferencesContext.Provider>
    );
    const { result } = renderHook(() => useDarkMode(), { wrapper: fallbackWrapper });
    act(() => {
      result.current.setTheme('dark');
    });
    expect(localStorage.setItem).toHaveBeenCalledWith('oricms-dark-mode', 'true');
  });

  it('dispatches custom theme change event', () => {
    const listener = vi.fn();
    window.addEventListener('oricms-theme-change', listener);
    const { result } = renderHook(() => useDarkMode(), { wrapper });
    act(() => {
      result.current.setTheme('dark');
    });
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('oricms-theme-change', listener);
  });
});
