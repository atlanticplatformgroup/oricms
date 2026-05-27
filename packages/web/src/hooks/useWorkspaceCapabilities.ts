import type { useProjectPermissions } from '../contexts/useProject';

type PermissionChecker = ReturnType<typeof useProjectPermissions>['hasPermission'];

export function useWorkspaceCapabilities(hasPermission: PermissionChecker) {
  const canCreateEntries = hasPermission('entries', 'create');
  const canUpdateEntries = hasPermission('entries', 'update');
  const canDeleteEntries = hasPermission('entries', 'delete');
  const canCreateCollections = hasPermission('schemas', 'create');
  const canUpdateCollections = hasPermission('schemas', 'update');
  const canDeleteCollections = hasPermission('schemas', 'delete');
  const canCreateAssets = hasPermission('assets', 'create');
  const canUpdateAssets = hasPermission('assets', 'update');
  const canDeleteAssets = hasPermission('assets', 'delete');
  const canManageGlobalMedia = hasPermission('settings', 'update') && hasPermission('assets', 'read');

  return {
    canCreateEntries,
    canUpdateEntries,
    canDeleteEntries,
    canCreateCollections,
    canUpdateCollections,
    canDeleteCollections,
    canCreateAssets,
    canUpdateAssets,
    canDeleteAssets,
    canManageGlobalMedia,
  };
}
