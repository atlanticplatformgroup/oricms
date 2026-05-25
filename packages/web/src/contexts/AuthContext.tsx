/**
 * Auth Context - JWT-based authentication
 * 
 * Replaces the old GitHub OAuth-only auth with full JWT support.
 * Handles token refresh, session persistence, and logout.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiError } from '../lib/api/core';
import { authApi } from '../lib/api/auth';
import { AuthContext, type AuthContextType, type AuthState } from './auth-context';

const USER_KEY = 'user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Initialize auth state from cookies + API
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { user } = await authApi.me();
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        setState({
          user,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) {
          try {
            await authApi.refreshToken();
            const { user } = await authApi.me();
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            setState({
              user,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch {
            clearAuth();
          }
        } else {
          clearAuth();
        }
      }
    };

    initAuth();
  }, []);

  // Set up token refresh interval
  // REMOVED: Redundant with on-demand refresh in client.ts. 
  // Causes race conditions with token rotation/replay detection.
  useEffect(() => {
    // Sync state across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === USER_KEY) {
        const userStr = localStorage.getItem(USER_KEY);
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            setState(prev => ({
              ...prev,
              user,
              isAuthenticated: true,
            }));
          } catch {
            // Invalid user JSON
          }
        } else {
          setState(prev => ({
            ...prev,
            user: null,
            isAuthenticated: false,
          }));
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const clearAuth = () => {
    localStorage.removeItem(USER_KEY);
    
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  };

  const login = useCallback(async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { user } = await authApi.login(email, password);
      
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      
      setState({
        user,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Login failed';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw error;
    }
  }, []);

  const register = useCallback(async (email: string, name: string, password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { user } = await authApi.register(email, name, password);
      
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      
      setState({
        user,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Registration failed';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw error;
    }
  }, []);

  const githubLogin = useCallback(async (code: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { user } = await authApi.githubAuth(code);
      
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      
      setState({
        user,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'GitHub login failed';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    } finally {
      clearAuth();
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const value: AuthContextType = useMemo(() => ({
    ...state,
    login,
    register,
    githubLogin,
    logout,
    clearError,
    token: state.accessToken,
  }), [state, login, register, githubLogin, logout, clearError]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
