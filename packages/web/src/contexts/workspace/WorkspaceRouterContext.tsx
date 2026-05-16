import { createContext, useContext, type ReactNode } from 'react';
import { useWorkspaceRouter, type UseWorkspaceRouterOptions } from '../../hooks/useWorkspaceRouter';

const WorkspaceRouterContext = createContext<ReturnType<typeof useWorkspaceRouter> | null>(null);

export function WorkspaceRouterProvider({ children, ...options }: UseWorkspaceRouterOptions & { children: ReactNode }) {
  const value = useWorkspaceRouter(options);
  return <WorkspaceRouterContext.Provider value={value}>{children}</WorkspaceRouterContext.Provider>;
}

export function useWorkspaceRouterContext() {
  const value = useContext(WorkspaceRouterContext);
  if (!value) {
    throw new Error('useWorkspaceRouterContext must be used within WorkspaceRouterProvider');
  }
  return value;
}
