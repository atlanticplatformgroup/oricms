import { Router, type Request, type Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import type {
  CreateUiGroupRequest,
  GetUiGroupResponse,
  GetWorkspaceCatalogResponse,
  UiGroup,
} from '@ori/shared';
import { logger } from '../middleware/logger';
import { badRequest, created, notFound, ok } from '../lib/responses';
import { requireOwnerOrAdmin, requirePermission } from '../permissions/middleware';
import { ensureResourceNotLocked } from '../locks/middleware';
import { sendInternalError, sendNotFound, sendValidationError } from './shared';
import {
  buildWorkspaceCatalog,
  createUiGroupFromPayload,
  getWorkspaceProjectAndRole,
  normalizeUiGroups,
  persistUiGroups,
  SYSTEM_SURFACES,
  updateUiGroupFromBody,
} from './workspace-route-support';

const router = Router({ mergeParams: true });

router.get(
  '/:projectId/system-surfaces',
  requirePermission('collections', 'read'),
  async (req: Request, res: Response) => {
    ok(res, { systemSurfaces: SYSTEM_SURFACES });
  },
);

router.get(
  '/:projectId/ui-groups',
  requirePermission('collections', 'read'),
  async (req: Request, res: Response) => {
    try {
      const access = await getWorkspaceProjectAndRole(req);
      if (!access) {
        sendNotFound(res, 'Project membership not found');
        return;
      }
      const { project, role } = access;
      const { projectId } = req.params;

      const uiGroups = normalizeUiGroups(
        (project.settings as Record<string, unknown> | null | undefined)?.uiGroups,
        role,
        project.createdAt.toISOString(),
        project.updatedAt.toISOString(),
      );

      const catalog = await buildWorkspaceCatalog(projectId, role);
      const byGroupId = new Map(catalog.navigation.uiGroups.map((entry) => [entry.group.id, entry]));

      ok(res, {
        uiGroups: uiGroups.map((group) => byGroupId.get(group.id) ?? { group, collectionIds: [] }),
      });
    } catch (error) {
      logger.error({ msg: 'List UI groups error', error });
      sendInternalError(res, 'Failed to load UI groups');
    }
  },
);

router.get(
  '/:projectId/ui-groups/:uiGroupId',
  requirePermission('collections', 'read'),
  async (req: Request, res: Response) => {
    try {
      const access = await getWorkspaceProjectAndRole(req);
      if (!access) {
        sendNotFound(res, 'Project membership not found');
        return;
      }
      const { role } = access;

      const catalog = await buildWorkspaceCatalog(req.params.projectId, role);
      const match = catalog.navigation.uiGroups.find((entry) => entry.group.id === req.params.uiGroupId);
      if (!match) {
        notFound(res, 'UI group not found', 'UI_GROUP_NOT_FOUND');
        return;
      }

      const response: GetUiGroupResponse = { uiGroup: match };
      ok(res, response);
    } catch (error) {
      logger.error({ msg: 'Get UI group error', error });
      sendInternalError(res, 'Failed to load UI group');
    }
  },
);

router.post(
  '/:projectId/ui-groups',
  requireOwnerOrAdmin,
  [
    body('slug').trim().notEmpty(),
    body('label').trim().notEmpty(),
    body('description').optional().isString(),
    body('icon').optional().isString(),
    body('order').optional().isInt({ min: 0 }),
    body('visible').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.mapped());
        return;
      }

      const { projectId } = req.params;
      if (!(await ensureResourceNotLocked(req, res, {
        projectId,
        resourceType: 'projectSettings',
        resourceId: 'project-settings',
      }))) {
        return;
      }

      const access = await getWorkspaceProjectAndRole(req);
      if (!access) {
        sendNotFound(res, 'Project membership not found');
        return;
      }
      const { project, role } = access;

      const existing = normalizeUiGroups(
        (project.settings as Record<string, unknown> | null | undefined)?.uiGroups,
        role,
        project.createdAt.toISOString(),
        project.updatedAt.toISOString(),
      );

      const payload = req.body as CreateUiGroupRequest;
      const id = payload.slug.trim();
      if (existing.some((group) => group.id === id || group.slug === payload.slug.trim())) {
        badRequest(res, 'A UI group with that slug already exists', 'UI_GROUP_EXISTS');
        return;
      }

      const nextGroup: UiGroup = createUiGroupFromPayload(payload, existing, role);

      await persistUiGroups(projectId, [...existing, nextGroup], req);
      created(res, { uiGroup: { group: nextGroup, collectionIds: [] } });
    } catch (error) {
      logger.error({ msg: 'Create UI group error', error });
      sendInternalError(res, 'Failed to create UI group');
    }
  },
);

router.patch(
  '/:projectId/ui-groups/:uiGroupId',
  requireOwnerOrAdmin,
  [
    param('uiGroupId').trim().notEmpty(),
    body('label').optional().isString(),
    body('description').optional().isString(),
    body('icon').optional().isString(),
    body('order').optional().isInt({ min: 0 }),
    body('visible').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.mapped());
        return;
      }

      const { projectId, uiGroupId } = req.params;
      if (!(await ensureResourceNotLocked(req, res, {
        projectId,
        resourceType: 'projectSettings',
        resourceId: 'project-settings',
      }))) {
        return;
      }

      const access = await getWorkspaceProjectAndRole(req);
      if (!access) {
        sendNotFound(res, 'Project membership not found');
        return;
      }
      const { project, role } = access;

      const existing = normalizeUiGroups(
        (project.settings as Record<string, unknown> | null | undefined)?.uiGroups,
        role,
        project.createdAt.toISOString(),
        project.updatedAt.toISOString(),
      );
      const current = existing.find((group) => group.id === uiGroupId);
      if (!current) {
        notFound(res, 'UI group not found', 'UI_GROUP_NOT_FOUND');
        return;
      }

      const nextGroup: UiGroup = updateUiGroupFromBody(current, req.body as Record<string, unknown>);

      const nextUiGroups = existing.map((group) => (group.id === uiGroupId ? nextGroup : group));
      await persistUiGroups(projectId, nextUiGroups, req);

      const catalog = await buildWorkspaceCatalog(projectId, role);
      const summary = catalog.navigation.uiGroups.find((entry) => entry.group.id === uiGroupId) ?? {
        group: nextGroup,
        collectionIds: [],
      };

      ok(res, { uiGroup: summary });
    } catch (error) {
      logger.error({ msg: 'Update UI group error', error });
      sendInternalError(res, 'Failed to update UI group');
    }
  },
);

router.delete(
  '/:projectId/ui-groups/:uiGroupId',
  requireOwnerOrAdmin,
  [param('uiGroupId').trim().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.mapped());
        return;
      }

      const { projectId, uiGroupId } = req.params;
      if (!(await ensureResourceNotLocked(req, res, {
        projectId,
        resourceType: 'projectSettings',
        resourceId: 'project-settings',
      }))) {
        return;
      }

      const access = await getWorkspaceProjectAndRole(req);
      if (!access) {
        sendNotFound(res, 'Project membership not found');
        return;
      }
      const { project, role } = access;

      const existing = normalizeUiGroups(
        (project.settings as Record<string, unknown> | null | undefined)?.uiGroups,
        role,
        project.createdAt.toISOString(),
        project.updatedAt.toISOString(),
      );
      if (!existing.some((group) => group.id === uiGroupId)) {
        notFound(res, 'UI group not found', 'UI_GROUP_NOT_FOUND');
        return;
      }

      await persistUiGroups(
        projectId,
        existing.filter((group) => group.id !== uiGroupId),
        req,
      );

      ok(res, { deleted: true, uiGroupId });
    } catch (error) {
      logger.error({ msg: 'Delete UI group error', error });
      sendInternalError(res, 'Failed to delete UI group');
    }
  },
);

router.get(
  '/:projectId/workspace-catalog',
  requirePermission('collections', 'read'),
  async (req: Request, res: Response) => {
    try {
      const access = await getWorkspaceProjectAndRole(req);
      if (!access) {
        sendNotFound(res, 'Project membership not found');
        return;
      }
      const { role } = access;

      const catalog = await buildWorkspaceCatalog(req.params.projectId, role);
      const response: GetWorkspaceCatalogResponse = { catalog };
      ok(res, response);
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
        sendNotFound(res);
        return;
      }
      logger.error({ msg: 'Workspace catalog error', error });
      sendInternalError(res, 'Failed to load workspace catalog');
    }
  },
);

export default router;
