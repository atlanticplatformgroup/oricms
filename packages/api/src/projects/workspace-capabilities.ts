import type { CapabilitySet, ProjectRole, SystemSurface } from '@ori/shared';

export const SYSTEM_SURFACES: SystemSurface[] = [
  {
    id: 'collections',
    label: 'Collections',
    description: 'Create and configure collection containers.',
    locked: true,
    order: 0,
  },
  {
    id: 'schemas',
    label: 'Schemas',
    description: 'Manage record and component schemas.',
    locked: true,
    order: 1,
  },
  {
    id: 'media',
    label: 'Media',
    description: 'Browse files and asset metadata.',
    locked: true,
    order: 2,
  },
  {
    id: 'members',
    label: 'Members',
    description: 'Manage people and agent access.',
    locked: true,
    order: 3,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Configure project behavior and integrations.',
    locked: true,
    order: 4,
  },
];

export function createCapabilities(
  role: ProjectRole,
  area: 'collections' | 'schemas' | 'media' | 'members' | 'settings' | 'ui-groups',
): CapabilitySet {
  const privileged = role === 'owner' || role === 'admin';

  switch (area) {
    case 'collections':
      return {
        canCreate: role !== 'viewer',
        canRead: role !== 'viewer',
        canUpdate: role !== 'viewer',
        canDelete: privileged,
        canConfigure: privileged,
        canManageSchema: privileged,
        canPublish: role !== 'viewer',
      };
    case 'schemas':
      return {
        canCreate: privileged,
        canRead: privileged,
        canUpdate: privileged,
        canDelete: privileged,
        canConfigure: privileged,
        canManageSchema: privileged,
      };
    case 'media':
      return {
        canCreate: role !== 'viewer',
        canRead: true,
        canUpdate: role !== 'viewer',
        canDelete: privileged,
      };
    case 'members':
    case 'settings':
    case 'ui-groups':
      return {
        canCreate: privileged,
        canRead: privileged,
        canUpdate: privileged,
        canDelete: privileged,
        canConfigure: privileged,
      };
  }
}
