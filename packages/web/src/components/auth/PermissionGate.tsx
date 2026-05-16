/**
 * Permission Gate - Conditionally render based on user permissions
 * 
 * Usage:
 * <PermissionGate permission="canCreatePages">
 *   <NewPageButton />
 * </PermissionGate>
 * 
 * Or for "any of" permissions:
 * <PermissionGate any={['canCreatePages', 'canEditPages']}>
 *   <PageActions />
 * </PermissionGate>
 */

import { type ReactNode, cloneElement, type ReactElement } from 'react';
import { useProjectPermissions } from '../../contexts/useProject';
import type { Action, ExtendedPermissionSet, Resource } from '@ori/shared';

interface PermissionGateProps {
  permission?: keyof ExtendedPermissionSet;
  any?: (keyof ExtendedPermissionSet)[];
  all?: (keyof ExtendedPermissionSet)[];
  resource?: Resource;
  action?: Action;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  permission,
  any,
  all,
  resource,
  action,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { permissions, hasPermission } = useProjectPermissions();

  if ((resource && !action) || (!resource && action)) {
    throw new Error('PermissionGate requires both resource and action when using resource-based permissions');
  }

  if (resource && action && !hasPermission(resource, action)) {
    return <>{fallback}</>;
  }

  // Check single permission
  if (permission) {
    if (!permissions[permission]) {
      return <>{fallback}</>;
    }
  }

  // Check "any" permissions (OR logic)
  if (any && any.length > 0) {
    const hasAny = any.some(p => permissions[p]);
    if (!hasAny) {
      return <>{fallback}</>;
    }
  }

  // Check "all" permissions (AND logic)
  if (all && all.length > 0) {
    const hasAll = all.every(p => permissions[p]);
    if (!hasAll) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

/**
 * AdminGate - Only render for owners and admins
 */
export function AdminGate({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { role } = useProjectPermissions();
  
  if (role !== 'owner' && role !== 'admin') {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * OwnerGate - Only render for owners
 */
export function OwnerGate({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { role } = useProjectPermissions();
  
  if (role !== 'owner') {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * DisabledWrapper - Wraps a button/element to disable it based on permissions
 */
interface DisabledWrapperProps {
  permission?: keyof ExtendedPermissionSet;
  resource?: Resource;
  action?: Action;
  children: ReactElement;
  title?: string;
}

export function DisabledWrapper({ permission, resource, action, children, title }: DisabledWrapperProps) {
  const { permissions, hasPermission: hasResourcePermission } = useProjectPermissions();
  const isAllowed = resource && action
    ? hasResourcePermission(resource, action)
    : permission
      ? permissions[permission]
      : true;

  return cloneElement(children, {
    disabled: !isAllowed,
    title: !isAllowed 
      ? (title || 'You don\'t have permission to do this') 
      : children.props.title,
  });
}
