import { useContext } from 'react';
import { ProjectContext } from './project-context';

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

export function useProjectPermissions() {
  const { permissions, hasPermission, currentProject } = useProject();
  return {
    permissions,
    hasPermission,
    role: currentProject?.role || null,
  };
}
