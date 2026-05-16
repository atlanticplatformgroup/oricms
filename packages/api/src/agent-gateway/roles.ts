import type { Action, ProjectRole, Resource } from '@ori/shared';
import { getPermissionKey, getRolePermissions } from '@ori/shared';

export function hasAgentPermission(role: ProjectRole, resource: Resource, action: Action): boolean {
  const permissionKey = getPermissionKey(resource, action);
  return permissionKey ? Boolean(getRolePermissions(role)[permissionKey]) : false;
}

export function canReadAgentSchemas(role: ProjectRole): boolean {
  return hasAgentPermission(role, 'collections', 'read') || hasAgentPermission(role, 'contentTypes', 'read');
}

export function canReadAgentHistory(role: ProjectRole): boolean {
  return hasAgentPermission(role, 'collections', 'read');
}

export function canReadAgentRawFiles(role: ProjectRole): boolean {
  return role === 'owner' || role === 'admin';
}
