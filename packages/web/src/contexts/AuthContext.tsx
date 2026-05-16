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

const TOKEN_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
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

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem(TOKEN_KEY);
      const refreshToken = localStorage.getItem(REFRESH_KEY);

      if (accessToken && refreshToken) {
        try {
          // Validate token by fetching current user
          const { user } = await authApi.me();
          
          setState({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          // Token expired, try to refresh
          if (error instanceof ApiError && error.statusCode === 401) {
            try {
              const refreshed = await authApi.refreshToken(refreshToken);
              const { user } = await authApi.me();
              
              localStorage.setItem(TOKEN_KEY, refreshed.accessToken);
              localStorage.setItem(REFRESH_KEY, refreshed.refreshToken);
              
              setState({
                user,
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.refreshToken,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });
            } catch {
              // Refresh failed, clear auth
              clearAuth();
            }
          } else {
            clearAuth();
          }
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
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
      if (e.key === TOKEN_KEY || e.key === REFRESH_KEY || e.key === USER_KEY) {
        const accessToken = localStorage.getItem(TOKEN_KEY);
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        const userStr = localStorage.getItem(USER_KEY);
        
        if (accessToken && refreshToken && userStr) {
          try {
            const user = JSON.parse(userStr);
            setState(prev => ({
              ...prev,
              user,
              accessToken,
              refreshToken,
              isAuthenticated: true,
            }));
          } catch {
            // Invalid user JSON
          }
        } else if (!accessToken || !refreshToken) {
          setState(prev => ({
            ...prev,
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          }));
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
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
      
      const { user, accessToken, refreshToken } = await authApi.login(email, password);
      
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_KEY, refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      
      setState({
        user,
        accessToken,
        refreshToken,
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
      
      const { user, accessToken, refreshToken } = await authApi.register(email, name, password);
      
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_KEY, refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      
      setState({
        user,
        accessToken,
        refreshToken,
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
      
      const { user, accessToken, refreshToken } = await authApi.githubAuth(code);
      
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_KEY, refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      
      setState({
        user,
        accessToken,
        refreshToken,
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
      if (state.refreshToken) {
        await authApi.logout(state.refreshToken);
      }
    } catch {
      // Ignore logout errors
    } finally {
      clearAuth();
    }
  }, [state.refreshToken]);

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
