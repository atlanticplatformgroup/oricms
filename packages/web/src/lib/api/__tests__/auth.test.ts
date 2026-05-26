import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authApi } from '../auth';
import * as core from '../core';

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a user', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      user: { id: 'u1', email: 'test@example.com', name: 'Test' },
      accessToken: 'at',
      refreshToken: 'rt',
    });

    const result = await authApi.register('test@example.com', 'Test', 'password123');
    expect(result.user.email).toBe('test@example.com');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/auth/register', {
      method: 'POST',
      body: { email: 'test@example.com', name: 'Test', password: 'password123' },
      requiresAuth: false,
    });
  });

  it('logs in', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      user: { id: 'u1', email: 'test@example.com', name: 'Test' },
      accessToken: 'at',
      refreshToken: 'rt',
    });

    const result = await authApi.login('test@example.com', 'password123');
    expect(result.accessToken).toBe('at');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com', password: 'password123' },
      requiresAuth: false,
    });
  });

  it('authenticates with github', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      user: { id: 'u1', email: 'gh@example.com', name: 'GH' },
      accessToken: 'at',
      refreshToken: 'rt',
    });

    const result = await authApi.githubAuth('code123');
    expect(result.user.name).toBe('GH');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/auth/github', {
      method: 'POST',
      body: { code: 'code123' },
      requiresAuth: false,
    });
  });

  it('refreshes token', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      accessToken: 'new_at',
      refreshToken: 'new_rt',
    });

    const result = await authApi.refreshToken();
    expect(result.accessToken).toBe('new_at');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/auth/refresh', {
      method: 'POST',
      requiresAuth: false,
    });
  });

  it('logs out', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);

    await authApi.logout();
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/auth/logout', {
      method: 'POST',
      requiresAuth: false,
    });
  });

  it('fetches current user', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      user: { id: 'u1', email: 'test@example.com', name: 'Test' },
    });

    const result = await authApi.me();
    expect(result.user.id).toBe('u1');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/auth/me');
  });

  it('updates profile', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce({
      id: 'u1', email: 'test@example.com', name: 'Updated',
    });

    const result = await authApi.updateProfile({ name: 'Updated' });
    expect(result.name).toBe('Updated');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/auth/me', {
      method: 'PATCH',
      body: { name: 'Updated' },
    });
  });

  it('changes password', async () => {
    const requestSpy = vi.spyOn(core, 'request').mockResolvedValueOnce(undefined);

    await authApi.changePassword('old', 'new');
    expect(requestSpy).toHaveBeenCalledWith('/api/v1/auth/me/password', {
      method: 'POST',
      body: { currentPassword: 'old', newPassword: 'new' },
    });
  });
});
