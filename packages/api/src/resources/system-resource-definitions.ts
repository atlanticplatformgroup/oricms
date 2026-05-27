import type {
  ProjectRole,
  ResourceCapabilities,
  ResourceCollectionDetail,
  ResourceCollectionLink,
  ResourceDomain,
  ResourcePolicyDefinition,
  ResourceViewDefinition,
} from '@ori/shared';
import { getRolePermissions } from '@ori/shared';
import type { GitAssetService } from '../assets/service';

export type ResourceProjectRecord = {
  id: string;
  name: string;
  repoUrl: string | null;
  defaultBranch: string;
  settings: unknown;
};

export type SystemResourceContext = {
  projectId: string;
  role: ProjectRole;
  project: ResourceProjectRecord;
  workspacePath: string;
  assetService: GitAssetService;
};

export const RESOURCE_COLLECTION_IDS = {
  schemaTypes: 'schemas.types',
  schemaComponents: 'schemas.components',
  settings: 'settings.project',
  members: 'members.project',
  builds: 'builds.project',
  assets: 'assets.project',
} as const;

export function getContentResourceCollectionId(collectionId: string): string {
  return `content.${collectionId}`;
}

export function getContentCollectionIdFromResource(resourceCollectionId: string): string | null {
  return resourceCollectionId.startsWith('content.')
    ? resourceCollectionId.slice('content.'.length)
    : null;
}

export function createResourceCollectionLink(
  id: string,
  domain: ResourceDomain,
  collectionType: 'user' | 'system' | 'operational',
): ResourceCollectionLink {
  return {
    id,
    domain,
    collectionType,
    isSystem: collectionType !== 'user',
  };
}

function buildResourcePolicy(
  collectionType: 'user' | 'system' | 'operational',
  domain: ResourceDomain,
): ResourcePolicyDefinition {
  if (domain === 'schemas' || domain === 'settings' || domain === 'members') {
    return {
      privileged: true,
      schemaEditable: false,
      policyEditable: false,
      recordEditingMode: 'restricted',
    };
  }

  if (collectionType === 'operational') {
    return {
      privileged: false,
      schemaEditable: false,
      policyEditable: false,
      recordEditingMode: 'system-managed',
    };
  }

  return {
    privileged: false,
    schemaEditable: false,
    policyEditable: false,
    recordEditingMode: 'standard',
  };
}

function buildCapabilities(
  role: ProjectRole,
  domain: ResourceDomain,
  collectionType: 'user' | 'system' | 'operational',
): ResourceCapabilities {
  const permissions = getRolePermissions(role);
  const isPrivileged = role === 'owner' || role === 'admin';

  if (domain === 'content') {
    return {
      canCreate: permissions.canCreateEntries,
      canRead: permissions.canEditEntries,
      canUpdate: permissions.canEditEntries,
      canDelete: permissions.canDeleteEntries,
      canPublish: permissions.canPublishEntries,
      canManageSchema: false,
      canManagePolicy: false,
    };
  }

  if (domain === 'schemas') {
    const canManageSchema = permissions.canEditSchemas || permissions.canEditContentTypes;
    return {
      canCreate: canManageSchema,
      canRead: canManageSchema,
      canUpdate: canManageSchema,
      canDelete: canManageSchema,
      canManageSchema,
      canManagePolicy: isPrivileged,
    };
  }

  if (domain === 'assets') {
    return {
      canCreate: permissions.canCreateAssets,
      canRead: permissions.canReadAssets,
      canUpdate: permissions.canUpdateAssets,
      canDelete: permissions.canDeleteAssets,
      canManageSchema: false,
      canManagePolicy: false,
    };
  }

  if (domain === 'members') {
    return {
      canCreate: permissions.canManageMembers,
      canRead: permissions.canManageMembers,
      canUpdate: permissions.canManageMembers,
      canDelete: permissions.canManageMembers,
      canManageSchema: false,
      canManagePolicy: isPrivileged,
    };
  }

  if (domain === 'settings') {
    return {
      canCreate: false,
      canRead: permissions.canUpdateSettings,
      canUpdate: permissions.canUpdateSettings,
      canDelete: false,
      canManageSchema: false,
      canManagePolicy: isPrivileged,
    };
  }

  return {
    canCreate: role !== 'viewer',
    canRead: true,
    canUpdate: isPrivileged || collectionType === 'operational',
    canDelete: isPrivileged,
    canManageSchema: false,
    canManagePolicy: false,
  };
}

function buildView(
  id: string,
  editor: ResourceViewDefinition['editor'],
): ResourceViewDefinition {
  return {
    id,
    kind: editor === 'builds' ? 'table' : editor === 'schemas' ? 'detail' : 'form',
    editor,
  };
}

export function createResourceCollectionDetail(
  role: ProjectRole,
  id: string,
  domain: ResourceDomain,
  collectionType: 'user' | 'system' | 'operational',
  label: string,
  options: {
    description?: string;
    schemaId?: string;
    viewId?: string;
    recordCount?: number;
    path?: string;
    source?: 'git' | 'database' | 'hybrid';
    view?: ResourceViewDefinition;
  } = {},
): ResourceCollectionDetail {
  const link = createResourceCollectionLink(id, domain, collectionType);

  return {
    ...link,
    label,
    description: options.description,
    schemaId: options.schemaId,
    viewId: options.viewId,
    recordCount: options.recordCount,
    capabilities: buildCapabilities(role, domain, collectionType),
    policySummary: buildResourcePolicy(collectionType, domain),
    path: options.path,
    source: options.source ?? 'hybrid',
    view: options.view,
  };
}

export function createSystemResourceView(id: string, editor: ResourceViewDefinition['editor']) {
  return buildView(id, editor);
}
