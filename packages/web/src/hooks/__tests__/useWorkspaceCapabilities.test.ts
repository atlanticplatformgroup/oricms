import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkspaceCapabilities } from '../useWorkspaceCapabilities';

describe('useWorkspaceCapabilities', () => {
  it('returns all true when user has all permissions', () => {
    const hasPermission = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() => useWorkspaceCapabilities(hasPermission));

    expect(result.current.canCreateEntries).toBe(true);
    expect(result.current.canUpdateEntries).toBe(true);
    expect(result.current.canDeleteEntries).toBe(true);
    expect(result.current.canCreateCollections).toBe(true);
    expect(result.current.canUpdateCollections).toBe(true);
    expect(result.current.canDeleteCollections).toBe(true);
    expect(result.current.canCreateAssets).toBe(true);
    expect(result.current.canUpdateAssets).toBe(true);
    expect(result.current.canDeleteAssets).toBe(true);
    expect(result.current.canManageGlobalMedia).toBe(true);

    expect(hasPermission).toHaveBeenCalledWith('entries', 'create');
    expect(hasPermission).toHaveBeenCalledWith('settings', 'update');
    expect(hasPermission).toHaveBeenCalledWith('assets', 'read');
  });

  it('returns all false when user has no permissions', () => {
    const hasPermission = vi.fn().mockReturnValue(false);
    const { result } = renderHook(() => useWorkspaceCapabilities(hasPermission));

    expect(result.current.canCreateEntries).toBe(false);
    expect(result.current.canUpdateEntries).toBe(false);
    expect(result.current.canDeleteEntries).toBe(false);
    expect(result.current.canCreateCollections).toBe(false);
    expect(result.current.canUpdateCollections).toBe(false);
    expect(result.current.canDeleteCollections).toBe(false);
    expect(result.current.canCreateAssets).toBe(false);
    expect(result.current.canUpdateAssets).toBe(false);
    expect(result.current.canDeleteAssets).toBe(false);
    expect(result.current.canManageGlobalMedia).toBe(false);
  });

  it('requires both settings.update and assets.read for global media', () => {
    const hasPermission = vi.fn().mockImplementation((resource: string, action: string) => {
      if (resource === 'settings' && action === 'update') return true;
      if (resource === 'assets' && action === 'read') return false;
      return true;
    });

    const { result } = renderHook(() => useWorkspaceCapabilities(hasPermission));
    expect(result.current.canManageGlobalMedia).toBe(false);
  });

  it('returns true for global media only when both permissions are granted', () => {
    const hasPermission = vi.fn().mockImplementation((resource: string, action: string) => {
      if (resource === 'settings' && action === 'update') return true;
      if (resource === 'assets' && action === 'read') return true;
      return false;
    });

    const { result } = renderHook(() => useWorkspaceCapabilities(hasPermission));
    expect(result.current.canManageGlobalMedia).toBe(true);
    expect(result.current.canCreateEntries).toBe(false);
  });
});
