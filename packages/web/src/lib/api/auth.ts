import type { User } from '@ori/shared';
import { request } from './core';

export const authApi = {
  async register(email: string, name: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    return request('/api/v1/auth/register', {
      method: 'POST',
      body: { email, name, password },
      requiresAuth: false,
    });
  },

  async login(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    return request('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
      requiresAuth: false,
    });
  },

  async githubAuth(code: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    return request('/api/v1/auth/github', {
      method: 'POST',
      body: { code },
      requiresAuth: false,
    });
  },

  async refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
    return request('/api/v1/auth/refresh', {
      method: 'POST',
      requiresAuth: false,
    });
  },

  async logout(): Promise<void> {
    return request('/api/v1/auth/logout', {
      method: 'POST',
      requiresAuth: false,
    });
  },

  async me(): Promise<{ user: User }> {
    return request('/api/v1/auth/me');
  },

  async updateProfile(updates: { name?: string; avatarUrl?: string }): Promise<User> {
    return request('/api/v1/auth/me', {
      method: 'PATCH',
      body: updates,
    });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return request('/api/v1/auth/me/password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
  },
};
