import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { UserPreferencesProvider } from '../UserPreferencesContext';
import { useUserPreferences } from '../useUserPreferences';
import { AuthContext, type AuthContextType } from '../auth-context';
import { ToastProvider } from '../ToastContext';
import * as core from '../../lib/api/core';
import type { UserPreferences } from '@ori/shared';

vi.mock('../../lib/api/core', async () => {
  const actual = await vi.importActual('../../lib/api/core');
  return { ...actual, request: vi.fn() };
});

const defaultPreferences: UserPreferences = {
  theme: 'light',
  editorMode: 'split',
  notifications: { builds: true, invites: true, mentions: true },
  projectDefaults: {},
  lastVisitedProjectId: null,
  onboarding: { version: 2, lastStep: 'welcome', completedAt: null, createdProjectId: null },
};

function createMockAuth(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    githubLogin: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    token: null,
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={createMockAuth()}>
      <ToastProvider>
        <UserPreferencesProvider>{children}</UserPreferencesProvider>
      </ToastProvider>
    </AuthContext.Provider>
  );
}

describe('UserPreferencesContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws when useUserPreferences is used outside provider', () => {
    expect(() => renderHook(() => useUserPreferences())).toThrow(
      'useUserPreferences must be used within a UserPreferencesProvider'
    );
  });

  it('initializes with defaults when no cache', async () => {
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    expect(result.current.preferences.theme).toBe('light');
    expect(result.current.preferences.editorMode).toBe('split');
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('loads cached preferences from localStorage', async () => {
    const cached: Partial<UserPreferences> = { theme: 'dark', editorMode: 'code' };
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(cached));
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    expect(result.current.preferences.theme).toBe('dark');
    expect(result.current.preferences.editorMode).toBe('code');
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('fetches preferences from DB when authenticated', async () => {
    const dbPrefs: Partial<UserPreferences> = { theme: 'dark', editorMode: 'preview' };
    vi.mocked(core.request).mockResolvedValue(dbPrefs);
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    await waitFor(() => expect(result.current.preferences.theme).toBe('dark'));
    expect(result.current.preferences.editorMode).toBe('preview');
    expect(core.request).toHaveBeenCalledWith('/api/v1/auth/me/preferences');
  });

  it('falls back to cache when DB fetch fails', async () => {
    const cached: Partial<UserPreferences> = { theme: 'dark' };
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(cached));
    vi.mocked(core.request).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.preferences.theme).toBe('dark');
  });

  it('updates preferences locally and debounces DB sync', async () => {
    vi.mocked(core.request).mockResolvedValue(defaultPreferences);
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.updatePreferences({ theme: 'system' });
    });
    expect(result.current.preferences.theme).toBe('system');
    expect(localStorage.setItem).toHaveBeenCalled();
    expect(core.request).not.toHaveBeenCalledWith(
      '/api/v1/auth/me/preferences',
      expect.objectContaining({ method: 'PATCH' })
    );
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    await waitFor(() =>
      expect(core.request).toHaveBeenCalledWith(
        '/api/v1/auth/me/preferences',
        expect.objectContaining({ method: 'PATCH', body: { theme: 'system' } })
      )
    );
  });

  it('shows toast when DB sync fails', async () => {
    vi.mocked(core.request)
      .mockResolvedValueOnce(defaultPreferences)
      .mockRejectedValueOnce(new Error('DB down'));
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.updatePreferences({ theme: 'dark' });
    });
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    await waitFor(() => expect(core.request).toHaveBeenCalledTimes(2));
  });

  it('deep merges projectDefaults', async () => {
    vi.mocked(core.request).mockResolvedValue(defaultPreferences);
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.updatePreferences({
        projectDefaults: {
          p1: { defaultTab: 'schemas', sidebarCollapsed: true },
        },
      });
    });
    expect(result.current.preferences.projectDefaults.p1).toEqual({
      defaultTab: 'schemas',
      sidebarCollapsed: true,
    });
  });

  it('handles legacy string projectDefaults', async () => {
    vi.mocked(core.request).mockResolvedValue(defaultPreferences);
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.updatePreferences({
        projectDefaults: {
          p1: 'builds' as any,
        },
      });
    });
    expect(result.current.preferences.projectDefaults.p1).toEqual({
      defaultTab: 'builds',
      sidebarCollapsed: false,
    });
  });

  it('updateProjectDefault mutates and caches', async () => {
    vi.mocked(core.request).mockResolvedValue(defaultPreferences);
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.updateProjectDefault('p1', 'members');
    });
    expect(result.current.preferences.projectDefaults.p1).toEqual({
      defaultTab: 'members',
      sidebarCollapsed: false,
    });
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('setLastVisitedProject delegates to updatePreferences', async () => {
    vi.mocked(core.request).mockResolvedValue(defaultPreferences);
    const { result } = renderHook(() => useUserPreferences(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.setLastVisitedProject('proj-1');
    });
    expect(result.current.preferences.lastVisitedProjectId).toBe('proj-1');
  });

  it('skips DB fetch when not authenticated', async () => {
    const unauthWrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={createMockAuth({ isAuthenticated: false })}>
        <ToastProvider>
          <UserPreferencesProvider>{children}</UserPreferencesProvider>
        </ToastProvider>
      </AuthContext.Provider>
    );
    const { result } = renderHook(() => useUserPreferences(), { wrapper: unauthWrapper });
    expect(result.current.isLoading).toBe(false);
    expect(core.request).not.toHaveBeenCalled();
  });
});
