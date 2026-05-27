/**
 * Project Context - Multi-tenancy state management
 * 
 * Manages the current active project, project list, and permissions.
 * All content operations are scoped to the current project.
 */

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { projectsApi } from '../lib/api/projects';
import { gitApi } from '../lib/api/git';
import { collectionsApi } from '../lib/api/collections';
import type { CollectionConfig, ExtendedPermissionSet, ProjectMember, Resource, Action } from '@ori/shared';
import { getPermissionKey, getRolePermissions } from '@ori/shared';
import { useAuth } from './useAuth';
import { useUserPreferences } from './useUserPreferences';
import { ProjectContext, type GitStatus, type ProjectContextType, type ProjectWithRole } from './project-context';

const EMPTY_PERMISSIONS: ExtendedPermissionSet = {
  canEditSchemas: false,
  canManageMembers: false,
  canDeleteProject: false,
  canEditContentTypes: false,
  canCreateEntries: false,
  canEditEntries: false,
  canDeleteEntries: false,
  canPublishEntries: false,
  canCreateAssets: false,
  canReadAssets: false,
  canUpdateAssets: false,
  canDeleteAssets: false,
  canUpdateSettings: false,
  canManageAgentAccess: false,
  canViewAgentAuditLog: false,
  canRevokeAgentAccess: false,
};

const CURRENT_PROJECT_KEY = 'currentProjectId';

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { preferences, setLastVisitedProject } = useUserPreferences();

  // Project list
  const [projects, setProjects] = useState<ProjectWithRole[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Current project
  const [currentProject, setCurrentProjectState] = useState<ProjectWithRole | null>(null);
  const currentProjectId = currentProject?.id ?? null;

  // Project data
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Git status
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);

  // Schemas
  const [schemas, setSchemas] = useState<{ name: string; path: string }[]>([]);
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);
  const [schemasError, setSchemasError] = useState<string | null>(null);

  // Collections
  const [collections, setCollections] = useState<CollectionConfig[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);

  // Persistence: Restore project from localStorage or user preferences
  useEffect(() => {
    if (projects.length > 0 && !currentProject) {
      const storedProjectId = localStorage.getItem(CURRENT_PROJECT_KEY);
      const lastVisitedId = preferences.lastVisitedProjectId;
      const targetId = storedProjectId || lastVisitedId;

      if (targetId) {
        const project = projects.find((s) => s.id === targetId);
        if (project) {
          setCurrentProjectState(project);
          return;
        }
      }

      // Default to first project if no preference found
      setCurrentProjectState(projects[0]);
    }
  }, [projects, currentProject, preferences.lastVisitedProjectId]);

  const refreshProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const { projects: projectList } = await projectsApi.list();
      setProjects(projectList);
      setCurrentProjectState((previous) => {
        if (!previous) return previous;
        return projectList.find((project) => project.id === previous.id) ?? previous;
      });
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const setCurrentProject = useCallback((project: ProjectWithRole | null) => {
    setCurrentProjectState(project);
    if (project) {
      localStorage.setItem(CURRENT_PROJECT_KEY, project.id);
    } else {
      localStorage.removeItem(CURRENT_PROJECT_KEY);
    }
  }, []);

  const refreshMembers = useCallback(async () => {
    if (!currentProjectId) return;

    setIsLoadingMembers(true);
    try {
      const { members: memberList } = await projectsApi.listMembers(currentProjectId);
      setMembers(memberList);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [currentProjectId]);

  const refreshGitStatus = useCallback(async () => {
    if (!currentProjectId) return;

    try {
      const { status } = await gitApi.getStatus(currentProjectId);
      setGitStatus(status);
    } catch (error) {
      console.error('Failed to load git status:', error);
      setGitStatus(null);
    }
  }, [currentProjectId]);

  const refreshSchemas = useCallback(async () => {
    if (!currentProjectId) return;

    setIsLoadingSchemas(true);
    setSchemasError(null);
    try {
      const { schemas: schemaList } = await gitApi.getSchemas(currentProjectId);
      setSchemas(schemaList);
    } catch (error) {
      console.error('Failed to load schemas:', error);
      setSchemasError(error instanceof Error ? error.message : 'Failed to load schemas');
      setSchemas([]);
    } finally {
      setIsLoadingSchemas(false);
    }
  }, [currentProjectId]);

  const refreshCollections = useCallback(async () => {
    if (!currentProjectId) return;

    setIsLoadingCollections(true);
    try {
      const response = await collectionsApi.list(currentProjectId);
      setCollections(response.collections || []);
    } catch (error) {
      console.error('Failed to load collections:', error);
      setCollections([]);
    } finally {
      setIsLoadingCollections(false);
    }
  }, [currentProjectId]);

  // Load projects on mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      void refreshProjects();
    } else {
      setProjects([]);
      setCurrentProjectState(null);
    }
  }, [isAuthenticated, refreshProjects]);

  // Record analytics/preference when project changes
  useEffect(() => {
    if (currentProject) {
      setLastVisitedProject(currentProject.id);
      void refreshGitStatus();
      void refreshCollections();
      void refreshMembers();
    }
  }, [currentProject, refreshCollections, refreshGitStatus, refreshMembers, setLastVisitedProject]);

  // Compute permissions based on current role
  const permissions: ExtendedPermissionSet = useMemo(() => {
    if (!currentProject) {
      return EMPTY_PERMISSIONS;
    }

    return getRolePermissions(currentProject.role);
  }, [currentProject]);

  const hasPermission = useCallback((resource: Resource, action: Action): boolean => {
    const key = getPermissionKey(resource, action);
    return key ? permissions[key] || false : false;
  }, [permissions]);

  const value: ProjectContextType = useMemo(() => ({
    projects,
    isLoadingProjects,
    refreshProjects,

    currentProject,
    setCurrentProject,

    members,
    isLoadingMembers,
    refreshMembers,

    permissions,
    hasPermission,

    gitStatus,
    refreshGitStatus,

    schemas,
    isLoadingSchemas,
    schemasError,
    refreshSchemas,

    collections,
    isLoadingCollections,
    refreshCollections,
  }), [
    projects,
    isLoadingProjects,
    refreshProjects,
    currentProject,
    setCurrentProject,
    members,
    isLoadingMembers,
    refreshMembers,
    permissions,
    hasPermission,
    gitStatus,
    refreshGitStatus,
    schemas,
    isLoadingSchemas,
    schemasError,
    refreshSchemas,
    collections,
    isLoadingCollections,
    refreshCollections,
  ]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}
