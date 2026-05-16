import { createContext } from 'react';
import type { User } from '@ori/shared';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  githubLogin: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  token: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
