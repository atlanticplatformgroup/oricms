import type { CreateUiGroupRequest, ProjectRole, UiGroup } from '@ori/shared';
import { createCapabilities } from './workspace-capabilities';

export function normalizeUiGroups(
  rawGroups: unknown,
  role: ProjectRole,
  fallbackCreatedAt: string,
  fallbackUpdatedAt: string,
): UiGroup[] {
  if (!Array.isArray(rawGroups)) return [];

  return rawGroups
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry, index) => {
      const slug = typeof entry.slug === 'string' && entry.slug.trim() ? entry.slug.trim() : `group-${index + 1}`;
      const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : slug;
      return {
        id,
        slug,
        label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : slug,
        description: typeof entry.description === 'string' ? entry.description : undefined,
        icon: typeof entry.icon === 'string' ? entry.icon : undefined,
        order: typeof entry.order === 'number' ? entry.order : index,
        visible: entry.visible !== false,
        locked: entry.locked === true,
        capabilities: createCapabilities(role, 'ui-groups'),
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : fallbackCreatedAt,
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : fallbackUpdatedAt,
      };
    })
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
}

export function createUiGroupFromPayload(
  payload: CreateUiGroupRequest,
  existing: UiGroup[],
  role: ProjectRole,
): UiGroup {
  const slug = payload.slug.trim();
  const now = new Date().toISOString();

  return {
    id: slug,
    slug,
    label: payload.label.trim(),
    description: payload.description,
    icon: payload.icon,
    order: typeof payload.order === 'number' ? payload.order : existing.length,
    visible: payload.visible !== false,
    locked: false,
    capabilities: createCapabilities(role, 'ui-groups'),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateUiGroupFromBody(
  current: UiGroup,
  body: Record<string, unknown>,
): UiGroup {
  return {
    ...current,
    ...(typeof body.label === 'string' ? { label: body.label.trim() } : {}),
    ...(typeof body.description === 'string' ? { description: body.description } : {}),
    ...(typeof body.icon === 'string' ? { icon: body.icon } : {}),
    ...(typeof body.order === 'number' ? { order: body.order } : {}),
    ...(typeof body.visible === 'boolean' ? { visible: body.visible } : {}),
    updatedAt: new Date().toISOString(),
  };
}
