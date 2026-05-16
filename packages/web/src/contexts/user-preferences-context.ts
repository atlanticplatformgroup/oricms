import { createContext } from 'react';
import type { UserPreferences } from '@ori/shared';

export interface UserPreferencesContextType {
  preferences: UserPreferences;
  isLoading: boolean;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  updateProjectDefault: (projectId: string, tab: 'collections' | 'schemas' | 'builds' | 'members' | 'settings') => void;
  setLastVisitedProject: (projectId: string | null) => void;
}

export const UserPreferencesContext = createContext<UserPreferencesContextType | null>(null);
