/**
 * Dark Mode Context - Manage dark/light theme preference
 * 
 * Phase 8.4: Now uses UserPreferencesContext for DB-backed, cross-device sync.
 * Falls back to localStorage when not authenticated.
 * Toggle is only exposed in Settings panel to avoid header clutter.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useUserPreferences } from './useUserPreferences';
import { DarkModeContext } from './dark-mode-context';

// Fallback storage key for non-authenticated users
const FALLBACK_STORAGE_KEY = 'oricms-dark-mode';
export const ORICMS_THEME_CHANGE_EVENT = 'oricms-theme-change';

function announceThemeChange(theme: 'light' | 'dark' | 'system', isDarkMode: boolean) {
  window.dispatchEvent(new CustomEvent(ORICMS_THEME_CHANGE_EVENT, { detail: { theme, isDarkMode } }));
}

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const preferencesContext = useUserPreferences?.();
  const hasUserPreferences = preferencesContext !== undefined;
  
  // Get theme from UserPreferences or fallback to localStorage
  const getInitialTheme = (): 'light' | 'dark' | 'system' => {
    if (hasUserPreferences) {
      return preferencesContext.preferences.theme;
    }
    // Fallback to localStorage for non-authenticated users
    const stored = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (stored === 'true') return 'dark';
    if (stored === 'false') return 'light';
    return 'light';
  };

  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(getInitialTheme());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Calculate initial dark mode state
    const initialTheme = getInitialTheme();
    if (initialTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return initialTheme === 'dark';
  });

  // Calculate if dark mode should be active based on theme
  const calculateDarkMode = useCallback((currentTheme: 'light' | 'dark' | 'system'): boolean => {
    if (currentTheme === 'dark') return true;
    if (currentTheme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, []);

  // Sync with UserPreferences when they load from DB
  useEffect(() => {
    if (hasUserPreferences && !preferencesContext.isLoading) {
      const dbTheme = preferencesContext.preferences.theme;
      const nextIsDarkMode = calculateDarkMode(dbTheme);
      setThemeState(dbTheme);
      setIsDarkMode(nextIsDarkMode);
      announceThemeChange(dbTheme, nextIsDarkMode);
    }
  }, [hasUserPreferences, preferencesContext?.preferences.theme, preferencesContext?.isLoading, calculateDarkMode]);

  // Apply dark mode class to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    document.documentElement.dataset.oriTheme = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  // Listen for system preference changes (when theme is 'system')
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: 'light' | 'dark' | 'system') => {
    const nextIsDarkMode = calculateDarkMode(newTheme);
    setThemeState(newTheme);
    setIsDarkMode(nextIsDarkMode);
    announceThemeChange(newTheme, nextIsDarkMode);
    
    if (hasUserPreferences) {
      // Sync to database via UserPreferencesContext
      preferencesContext.updatePreferences({ theme: newTheme });
    } else {
      // Fallback to localStorage for non-authenticated users
      if (newTheme === 'system') {
        localStorage.removeItem(FALLBACK_STORAGE_KEY);
      } else {
        localStorage.setItem(FALLBACK_STORAGE_KEY, String(newTheme === 'dark'));
      }
    }
  }, [hasUserPreferences, preferencesContext, calculateDarkMode]);

  const toggleDarkMode = useCallback(() => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setTheme(newTheme);
  }, [isDarkMode, setTheme]);

  const setDarkMode = useCallback((enabled: boolean) => {
    const newTheme = enabled ? 'dark' : 'light';
    setTheme(newTheme);
  }, [setTheme]);

  const value = useMemo(() => ({ isDarkMode, toggleDarkMode, setDarkMode, theme, setTheme }), [isDarkMode, toggleDarkMode, setDarkMode, theme, setTheme]);

  return (
    <DarkModeContext.Provider value={value}>
      {children}
    </DarkModeContext.Provider>
  );
}
