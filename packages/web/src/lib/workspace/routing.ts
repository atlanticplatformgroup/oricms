import { matchPath } from 'react-router-dom';
import { DEFAULT_SCHEMA_MODE, DEFAULT_SCHEMA_SECONDARY } from './constants';
import type { SchemaMode, SectionKey, WorkspaceRouteState } from './types';

function matchCanonicalWorkspacePath(pathname: string, suffix: string) {
  const match = matchPath(`/:projectSlug/b/:branchName${suffix}`, pathname);
  if (match?.params.projectSlug && match.params.branchName) {
    return {
      params: match.params as Record<string, string | undefined>,
      branchName: match.params.branchName,
    };
  }

  return null;
}

function matchLegacyWorkspacePath(pathname: string, suffix: string) {
  const match = matchPath(`/:projectSlug${suffix}`, pathname);
  if (match?.params.projectSlug) {
    return {
      params: match.params as Record<string, string | undefined>,
      branchName: null,
    };
  }

  return null;
}

function parseWorkspacePathWithMatcher(
  pathname: string,
  matchWorkspacePath: (pathname: string, suffix: string) => { params: Record<string, string | undefined>; branchName: string | null } | null,
): WorkspaceRouteState | null {
  const collectionEntryHistory = matchWorkspacePath(pathname, '/collections/:collectionId/entries/:entryId/history');
  if (collectionEntryHistory?.params.projectSlug && collectionEntryHistory.params.collectionId && collectionEntryHistory.params.entryId) {
    return {
      projectSlug: collectionEntryHistory.params.projectSlug,
      branchName: collectionEntryHistory.branchName,
      section: 'collections',
      secondaryId: collectionEntryHistory.params.collectionId,
      entryId: collectionEntryHistory.params.entryId,
      historyView: true,
      collectionSettingsView: false,
      schemaMode: DEFAULT_SCHEMA_MODE,
    };
  }

  const collectionEntry = matchWorkspacePath(pathname, '/collections/:collectionId/entries/:entryId');
  if (collectionEntry?.params.projectSlug && collectionEntry.params.collectionId && collectionEntry.params.entryId) {
    return {
      projectSlug: collectionEntry.params.projectSlug,
      branchName: collectionEntry.branchName,
      section: 'collections',
      secondaryId: collectionEntry.params.collectionId,
      entryId: collectionEntry.params.entryId,
      historyView: false,
      collectionSettingsView: false,
      schemaMode: DEFAULT_SCHEMA_MODE,
    };
  }

  const collectionSettings = matchWorkspacePath(pathname, '/collections/:collectionId/settings');
  if (collectionSettings?.params.projectSlug && collectionSettings.params.collectionId) {
    return {
      projectSlug: collectionSettings.params.projectSlug,
      branchName: collectionSettings.branchName,
      section: 'collections',
      secondaryId: collectionSettings.params.collectionId,
      entryId: null,
      historyView: false,
      collectionSettingsView: true,
      schemaMode: DEFAULT_SCHEMA_MODE,
    };
  }

  const collection = matchWorkspacePath(pathname, '/collections/:collectionId');
  if (collection?.params.projectSlug && collection.params.collectionId) {
    return {
      projectSlug: collection.params.projectSlug,
      branchName: collection.branchName,
      section: 'collections',
      secondaryId: collection.params.collectionId,
      entryId: null,
      historyView: false,
      collectionSettingsView: false,
      schemaMode: DEFAULT_SCHEMA_MODE,
    };
  }

  const schema = matchWorkspacePath(pathname, '/schemas/:mode/:schemaId');
  if (schema?.params.projectSlug && schema.params.mode && schema.params.schemaId) {
    const mode = schema.params.mode === 'components' ? 'components' : 'types';
      return {
        projectSlug: schema.params.projectSlug,
        branchName: schema.branchName,
        section: 'schemas',
        secondaryId: schema.params.schemaId,
        entryId: null,
        historyView: false,
        collectionSettingsView: false,
        schemaMode: mode,
      };
  }

  for (const section of ['media', 'builds', 'members', 'settings'] as const) {
    const match = matchWorkspacePath(pathname, `/${section}/:view`);
    if (match?.params.projectSlug && match.params.view) {
        return {
          projectSlug: match.params.projectSlug,
          branchName: match.branchName,
          section,
          secondaryId: match.params.view,
          entryId: null,
          historyView: false,
          collectionSettingsView: false,
          schemaMode: DEFAULT_SCHEMA_MODE,
        };
      }
  }

  for (const section of ['collections', 'schemas', 'media', 'builds', 'members', 'settings'] as const) {
    const match = matchWorkspacePath(pathname, `/${section}`);
    if (match?.params.projectSlug) {
        return {
          projectSlug: match.params.projectSlug,
          branchName: match.branchName,
          section,
          secondaryId: null,
          entryId: null,
          historyView: false,
          collectionSettingsView: false,
          schemaMode: DEFAULT_SCHEMA_MODE,
        };
      }
  }

  const projectRoot = matchWorkspacePath(pathname, '');
  if (projectRoot?.params.projectSlug) {
    return {
      projectSlug: projectRoot.params.projectSlug,
      branchName: projectRoot.branchName,
      section: 'collections',
      secondaryId: null,
      entryId: null,
      historyView: false,
      collectionSettingsView: false,
      schemaMode: DEFAULT_SCHEMA_MODE,
    };
  }

  return null;
}

export function parseWorkspacePath(pathname: string): WorkspaceRouteState | null {
  return parseWorkspacePathWithMatcher(pathname, matchCanonicalWorkspacePath);
}

export function parseLegacyWorkspacePath(pathname: string): WorkspaceRouteState | null {
  return parseWorkspacePathWithMatcher(pathname, matchLegacyWorkspacePath);
}

function normalizeCompatibilitySecondaryId(route: WorkspaceRouteState): string | null {
  if (route.section === 'settings' && route.secondaryId === 'branch-mappings') {
    return 'environments';
  }
  return route.secondaryId;
}

export function normalizeWorkspaceCompatibilityRoute(route: WorkspaceRouteState): WorkspaceRouteState {
  return {
    ...route,
    secondaryId: normalizeCompatibilitySecondaryId(route),
  };
}

export function buildWorkspaceCompatibilityRedirect(
  route: WorkspaceRouteState,
  defaultBranchName: string,
): string | null {
  const nextRoute = normalizeWorkspaceCompatibilityRoute(route);
  const nextSecondaryId = nextRoute.secondaryId;
  const needsBranchRedirect = !route.branchName;
  const needsSettingsAliasRedirect = nextSecondaryId !== route.secondaryId;

  if (!needsBranchRedirect && !needsSettingsAliasRedirect) {
    return null;
  }

  return buildWorkspacePath(nextRoute.projectSlug, nextRoute.section, nextSecondaryId, {
    branchName: route.branchName ?? defaultBranchName,
    entryId: nextRoute.entryId,
    schemaMode: nextRoute.schemaMode,
    historyView: nextRoute.historyView,
    collectionSettingsView: nextRoute.collectionSettingsView,
  });
}

export function buildWorkspacePath(
  projectSlug: string,
  section: SectionKey,
  secondaryId?: string | null,
  opts?: {
    entryId?: string | null;
    schemaMode?: SchemaMode;
    historyView?: boolean;
    collectionSettingsView?: boolean;
    branchName?: string | null;
  },
): string {
  const basePath = opts?.branchName ? `/${projectSlug}/b/${encodeURIComponent(opts.branchName)}` : `/${projectSlug}`;

  if (section === 'collections') {
    const collectionId = secondaryId || null;
    if (opts?.entryId) {
      if (opts.historyView) {
        return `${basePath}/collections/${collectionId}/entries/${opts.entryId}/history`;
      }
      return `${basePath}/collections/${collectionId}/entries/${opts.entryId}`;
    }
    if (!collectionId) return `${basePath}/collections`;
    if (opts?.collectionSettingsView) {
      return `${basePath}/collections/${collectionId}/settings`;
    }
    return `${basePath}/collections/${collectionId}`;
  }

  if (section === 'schemas') {
    const mode = opts?.schemaMode || DEFAULT_SCHEMA_MODE;
    return `${basePath}/schemas/${mode}/${secondaryId || DEFAULT_SCHEMA_SECONDARY}`;
  }

  if (!secondaryId) return `${basePath}/${section}`;
  return `${basePath}/${section}/${secondaryId}`;
}
