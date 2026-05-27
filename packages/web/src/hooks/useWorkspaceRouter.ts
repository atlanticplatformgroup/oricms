import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Project, ProjectRole } from '@ori/shared';
import { buildWorkspaceCompatibilityRedirect, buildWorkspacePath, normalizeWorkspaceCompatibilityRoute, parseLegacyWorkspacePath, parseWorkspacePath } from '../lib/workspace/routing';
import { DEFAULT_SCHEMA_MODE } from '../lib/workspace/constants';

type ProjectWithRole = Project & { role: ProjectRole };

export interface UseWorkspaceRouterOptions {
  projects: ProjectWithRole[];
  currentProject: ProjectWithRole | null;
  setCurrentProject: (project: ProjectWithRole | null) => void;
  isLoadingProjects: boolean;
}

export function useWorkspaceRouter({
  projects,
  currentProject,
  setCurrentProject,
  isLoadingProjects,
}: UseWorkspaceRouterOptions) {
  const navigate = useNavigate();
  const location = useLocation();

  const workspaceRoute = useMemo(() => parseWorkspacePath(location.pathname), [location.pathname]);
  const normalizedWorkspaceRoute = useMemo(
    () => (workspaceRoute ? normalizeWorkspaceCompatibilityRoute(workspaceRoute) : null),
    [workspaceRoute],
  );
  const compatibilityRoute = useMemo(
    () => (workspaceRoute ? null : parseLegacyWorkspacePath(location.pathname)),
    [location.pathname, workspaceRoute],
  );
  const normalizedCompatibilityRoute = useMemo(
    () => (compatibilityRoute ? normalizeWorkspaceCompatibilityRoute(compatibilityRoute) : null),
    [compatibilityRoute],
  );
  const resolvedRoute = normalizedWorkspaceRoute ?? normalizedCompatibilityRoute;
  const compatibilitySourceRoute = workspaceRoute ?? compatibilityRoute;
  const routeProjectSlug = compatibilitySourceRoute?.projectSlug ?? null;
  const routeProject = useMemo(
    () => (routeProjectSlug ? projects.find((project) => project.slug === routeProjectSlug) ?? null : null),
    [projects, routeProjectSlug],
  );
  const activeProjectSlug = routeProject?.slug || currentProject?.slug || null;
  const routeDefaultBranch = routeProject?.defaultBranch || currentProject?.defaultBranch || 'main';
  const redirectTo = useMemo(() => {
    if (!compatibilitySourceRoute) {
      return currentProject
        ? buildWorkspacePath(currentProject.slug, 'collections', null, { branchName: currentProject.defaultBranch || 'main' })
        : null;
    }

    if (routeProject) {
      return buildWorkspaceCompatibilityRedirect(compatibilitySourceRoute, routeDefaultBranch);
    }

    return null;
  }, [compatibilitySourceRoute, currentProject, routeProject, routeDefaultBranch]);

  const activeSection = resolvedRoute?.section || 'collections';
  const activeSecondaryId = resolvedRoute?.secondaryId || null;
  const activeEntryId = resolvedRoute?.entryId || null;
  const activeHistoryView = resolvedRoute?.historyView || false;
  const activeCollectionSettingsView = resolvedRoute?.collectionSettingsView || false;
  const activeSchemaMode = resolvedRoute?.schemaMode || DEFAULT_SCHEMA_MODE;
  const activeBranchName = resolvedRoute?.branchName || routeDefaultBranch;

  useEffect(() => {
    if (!routeProjectSlug || isLoadingProjects) return;

    if (routeProject) {
      if (currentProject?.id !== routeProject.id) {
        setCurrentProject(routeProject);
      }
      return;
    }

    if (currentProject) {
      const target = buildWorkspacePath(currentProject.slug, 'collections', null, { branchName: currentProject.defaultBranch || 'main' });
      if (location.pathname !== target) {
        navigate(target, { replace: true });
      }
    }
  }, [routeProjectSlug, isLoadingProjects, routeProject, currentProject, location.pathname, navigate, setCurrentProject]);

  return {
    activeProjectSlug,
    activeBranchName,
    redirectTo,
    activeSection,
    activeSecondaryId,
    activeEntryId,
    activeHistoryView,
    activeCollectionSettingsView,
    activeSchemaMode,
  };
}
