import type { useProjectPermissions } from '../contexts/useProject';

type PermissionChecker = ReturnType<typeof useProjectPermissions>['hasPermission'];

export function useWorkspaceCapabilities(hasPermission: PermissionChecker) {
  const canCreateEntries = hasPermission('collections', 'create');
  const canUpdateEntries = hasPermission('collections', 'update');
  const canDeleteEntries = hasPermission('collections', 'delete');
  const canCreateCollections = hasPermission('collections', 'create');
  const canUpdateCollections = hasPermission('collections', 'update');
  const canDeleteCollections = hasPermission('collections', 'delete');
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
