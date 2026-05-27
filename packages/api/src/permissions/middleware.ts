import type { Request, Response, NextFunction } from 'express';
import type { ProjectRole, Resource, Action } from '@ori/shared';
import { getPermissionKey, getRolePermissions } from '@ori/shared';
import { apiServices } from '../lib/api-services';
import { badRequest, forbidden, internalError, unauthorized } from '../lib/responses';

function normalizeResource(resource: string): Resource | null {
  switch (resource) {
    case 'pages':
      return 'collections';
    case 'content-types':
    case 'content_types':
      return 'contentTypes';
    case 'schemas':
    case 'entries':
    case 'assets':
    case 'settings':
    case 'members':
    case 'agents':
    case 'contentTypes':
    case 'collections':
      return resource;
    default:
      return null;
  }
}

/**
 * Check if user has permission for a resource/action on a project
 */
export async function checkPermission(
  userId: string,
  projectId: string,
  resource: Resource | string,
  action: Action,
  roleOverride?: ProjectRole | null,
): Promise<boolean> {
  const normalizedResource = normalizeResource(resource);
  if (!normalizedResource) {
    return false;
  }

  const role = roleOverride ?? (await apiServices.prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
    select: { role: true },
  }))?.role;
  if (!role) {
    return false;
  }

  const permissionKey = getPermissionKey(normalizedResource, action);
  if (!permissionKey) {
    return false;
  }

  return Boolean(getRolePermissions(role)[permissionKey]);
}

/**
 * Get user's role on a project
 */
export async function getUserRole(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const membership = await apiServices.prisma.projectMember.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
    select: { role: true },
  });
  return membership?.role || null;
}

/**
 * Check if user is owner or admin
 */
export async function isOwnerOrAdmin(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getUserRole(userId, projectId);
  return role === 'owner' || role === 'admin';
}

/**
 * Middleware factory for requiring specific permission
 */
export function requirePermission(resource: Resource | string, action: Action) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const projectId = req.params.projectId || req.projectId;
      const userId = req.userId;
      const normalizedResource = normalizeResource(resource);

      if (!userId) {
        unauthorized(res);
        return;
      }

      if (!projectId) {
        badRequest(res, 'Project ID required');
        return;
      }

      if (!normalizedResource) {
        forbidden(res, `Unknown permission resource: ${resource}`);
        return;
      }

      const hasPerm = await checkPermission(userId, projectId, normalizedResource, action, req.projectRole);

      if (!hasPerm) {
        const role = await getUserRole(userId, projectId);
        apiServices.logger.warn({ msg: 'Access denied', userId, role, projectId, resource: normalizedResource, action });
        forbidden(res, `You don't have permission to ${action} ${normalizedResource}`);
        return;
      }

      next();
    } catch (error) {
      apiServices.logger.error({ msg: 'Permission middleware error', error, resource, action });
      internalError(res, 'Permission check failed');
    }
  };
}

/**
 * Require owner or admin role
 */
export async function requireOwnerOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!userId) {
      unauthorized(res);
      return;
    }

    const isAdmin = await isOwnerOrAdmin(userId, projectId);

    if (!isAdmin) {
      forbidden(res, 'Owner or admin access required');
      return;
    }

    next();
  } catch (error) {
    apiServices.logger.error({ msg: 'Role check failed', error });
    internalError(res, 'Role check failed');
  }
}
