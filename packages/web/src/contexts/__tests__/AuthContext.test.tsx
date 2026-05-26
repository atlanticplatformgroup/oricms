import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthContext';
import { useAuth } from '../useAuth';
import { authApi } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/core';

vi.mock('../../lib/api/auth', () => ({
  authApi: {
    me: vi.fn(),
    refreshToken: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    githubAuth: vi.fn(),
    logout: vi.fn(),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('throws when useAuth is used outside provider', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within an AuthProvider');
  });

  it('initializes loading then unauthenticated when me fails with 401 and refresh fails', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError('Unauthorized', 'UNAUTHORIZED', 401));
    vi.mocked(authApi.refreshToken).mockRejectedValue(new Error('Refresh failed'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('restores session when me succeeds', async () => {
    const user = { id: 'u1', email: 'a@b.com', name: 'Alice' };
    vi.mocked(authApi.me).mockResolvedValue({ user } as any);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user).toEqual(user);
    expect(result.current.isLoading).toBe(false);
    expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(user));
  });

  it('refreshes token then restores session on 401', async () => {
    const user = { id: 'u2', email: 'b@c.com', name: 'Bob' };
    vi.mocked(authApi.me)
      .mockRejectedValueOnce(new ApiError('Unauthorized', 'UNAUTHORIZED', 401))
      .mockResolvedValueOnce({ user } as any);
    vi.mocked(authApi.refreshToken).mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' } as any);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user).toEqual(user);
    expect(authApi.refreshToken).toHaveBeenCalled();
  });

  it('logs in and sets user', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError('Unauthorized', 'UNAUTHORIZED', 401));
    vi.mocked(authApi.refreshToken).mockRejectedValue(new Error('Refresh failed'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const user = { id: 'u3', email: 'c@d.com', name: 'Carol' };
    vi.mocked(authApi.login).mockResolvedValue({ user } as any);
    await act(async () => {
      await result.current.login('c@d.com', 'password');
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(user);
    expect(result.current.error).toBeNull();
  });

  it('sets error on failed login', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError('Unauthorized', 'UNAUTHORIZED', 401));
    vi.mocked(authApi.refreshToken).mockRejectedValue(new Error('Refresh failed'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.mocked(authApi.login).mockRejectedValue(new ApiError('Bad credentials', 'INVALID_CREDENTIALS', 401));
    await act(async () => {
      try {
        await result.current.login('x@y.com', 'wrong');
      } catch {
        // expected to throw
      }
    });
    expect(result.current.error).toBe('Bad credentials');
  });

  it('registers and sets user', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError('Unauthorized', 'UNAUTHORIZED', 401));
    vi.mocked(authApi.refreshToken).mockRejectedValue(new Error('Refresh failed'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const user = { id: 'u4', email: 'd@e.com', name: 'Dave' };
    vi.mocked(authApi.register).mockResolvedValue({ user } as any);
    await act(async () => {
      await result.current.register('d@e.com', 'Dave', 'password');
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(user);
  });

  it('logs in with GitHub', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError('Unauthorized', 'UNAUTHORIZED', 401));
    vi.mocked(authApi.refreshToken).mockRejectedValue(new Error('Refresh failed'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const user = { id: 'u5', email: 'gh@example.com', name: 'Git' };
    vi.mocked(authApi.githubAuth).mockResolvedValue({ user } as any);
    await act(async () => {
      await result.current.githubLogin('code123');
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(user);
  });

  it('logs out and clears state', async () => {
    const user = { id: 'u1', email: 'a@b.com', name: 'Alice' };
    vi.mocked(authApi.me).mockResolvedValue({ user } as any);
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('user');
  });

  it('clears error', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError('Unauthorized', 'UNAUTHORIZED', 401));
    vi.mocked(authApi.refreshToken).mockRejectedValue(new Error('Refresh failed'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.mocked(authApi.login).mockRejectedValue(new ApiError('Oops', 'ERR', 500));
    await act(async () => {
      try {
        await result.current.login('a', 'b');
      } catch {
        // expected to throw
      }
    });
    expect(result.current.error).toBe('Oops');
    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it('syncs user across tabs via storage event', async () => {
    const user = { id: 'u1', email: 'a@b.com', name: 'Alice' };
    vi.mocked(authApi.me).mockResolvedValue({ user } as any);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    const newUser = { id: 'u2', email: 'b@c.com', name: 'Bob' };
    vi.mocked(localStorage.getItem as any).mockReturnValue(JSON.stringify(newUser));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'user', newValue: JSON.stringify(newUser) }));
    });
    await waitFor(() => expect(result.current.user).toEqual(newUser));
  });
});
