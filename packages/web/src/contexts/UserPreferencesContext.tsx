/**
 * User Preferences Context
 * 
 * Phase 8.4: Database-backed user preferences with cross-device sync.
 * 
 * Strategy:
 * - Database is the source of truth for preferences
 * - localStorage serves as a fast cache for instant load
 * - Fetch preferences on login, sync to DB on changes
 * - Fallback to localStorage if offline
 */

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { UserPreferences } from '@ori/shared';
import { request } from '../lib/api/core';
import { useAuth } from './useAuth';
import { useToast } from './ToastContext';
import { UserPreferencesContext } from './user-preferences-context';

const STORAGE_KEY = 'oricms-user-preferences-v1';

const defaultPreferences: UserPreferences = {
  theme: 'system',
  editorMode: 'split',
  notifications: {
    builds: true,
    invites: true,
    mentions: true,
  },
  projectDefaults: {},
  lastVisitedProjectId: null,
  onboarding: {
    version: 2,
    lastStep: 'welcome',
    completedAt: null,
    createdProjectId: null,
  },
};

// Load from localStorage as initial cache
function loadFromStorage(): Partial<UserPreferences> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...parsed };
    }
  } catch (error) {
    console.error('Failed to load preferences from storage:', error);
  }
  return {};
}

// Save to localStorage
function saveToStorage(preferences: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Failed to save preferences to storage:', error);
  }
}

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  
  const [preferences, setPreferences] = useState<UserPreferences>(() => ({
    ...defaultPreferences,
    ...loadFromStorage(),
  }));
  const [isLoading, setIsLoading] = useState(true);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch preferences from database on mount (if authenticated)
  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    async function fetchPreferences() {
      try {
        const dbPreferences = await request<UserPreferences>('/api/v1/auth/me/preferences');
        setPreferences((prev) => ({
          ...defaultPreferences,
          ...prev,
          ...dbPreferences,
        }));
        // Update cache
        saveToStorage({ ...defaultPreferences, ...dbPreferences });
      } catch (error) {
        console.error('Failed to fetch preferences from DB:', error);
        // Keep using cached preferences from localStorage
      } finally {
        setIsLoading(false);
      }
    }

    fetchPreferences();
  }, [isAuthenticated]);

  // Debounced sync to database
  const syncToDatabase = useCallback(async (updates: Partial<UserPreferences>) => {
    if (!isAuthenticated) return;

    try {
      await request('/api/v1/auth/me/preferences', { method: 'PATCH', body: updates });
    } catch (error) {
      console.error('Failed to sync preferences to DB:', error);
      showToast('Preferences saved locally, will sync when online', 'info');
    }
  }, [isAuthenticated, showToast]);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    setPreferences((prev: UserPreferences) => {
      const newPreferences: UserPreferences = { ...prev, ...updates };
      // Deep merge if projectDefaults is being updated
      if (updates.projectDefaults) {
        newPreferences.projectDefaults = {
          ...prev.projectDefaults,
        };
        // Merge each project default individually
        Object.entries(updates.projectDefaults).forEach(([projectId, projectDefault]) => {
          if (typeof projectDefault === 'string') {
            // Handle legacy string format
            newPreferences.projectDefaults[projectId] = {
              defaultTab: projectDefault as 'collections' | 'schemas' | 'builds' | 'members' | 'settings',
              sidebarCollapsed: prev.projectDefaults[projectId]?.sidebarCollapsed ?? false,
            };
          } else if (projectDefault) {
            newPreferences.projectDefaults[projectId] = {
              ...prev.projectDefaults[projectId],
              ...projectDefault,
            };
          }
        });
      }
      // Save to localStorage immediately
      saveToStorage(newPreferences);
      return newPreferences;
    });

    // Debounce sync to database
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    syncTimeoutRef.current = setTimeout(() => {
      syncToDatabase(updates);
    }, 1000);
  }, [syncToDatabase]);

  const updateProjectDefault = useCallback((projectId: string, tab: 'collections' | 'schemas' | 'builds' | 'members' | 'settings') => {
    setPreferences((prev: UserPreferences) => {
      const newPreferences = {
        ...prev,
        projectDefaults: {
          ...prev.projectDefaults,
          [projectId]: {
            defaultTab: tab,
            sidebarCollapsed: prev.projectDefaults[projectId]?.sidebarCollapsed ?? false,
          },
        },
      };
      saveToStorage(newPreferences);
      return newPreferences;
    });
  }, []);

  const setLastVisitedProject = useCallback((projectId: string | null) => {
    updatePreferences({ lastVisitedProjectId: projectId });
  }, [updatePreferences]);

  // Cleanup sync timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        isLoading,
        updatePreferences,
        updateProjectDefault,
        setLastVisitedProject,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}
