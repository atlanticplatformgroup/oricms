import { Router, type Request, type Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { logger } from '../middleware/logger';
import { conflict, created, ok, unauthorized } from '../lib/responses';
import { ensureResourceNotLocked } from '../locks/middleware';
import { requirePermission, requireOwnerOrAdmin } from '../permissions/middleware';
import {
  createProjectWithOwner,
  deleteProject,
  ensureOwnerProjectDeleteAccess,
  ensureProjectSlugAvailable,
  findProjectByIdWithMemberCount,
  findProjectSettings,
  listProjectsForUser,
  queueProjectConfigBootstrap,
  sanitizeProjectSettingsOrRespond,
  saveProjectConfigToGit,
  updateProjectRecord,
  validateProjectRepoUrl,
} from './project-route-support';
import { sendInternalError, sendNotFound, sendValidationError } from './shared';
import { RESOURCE_COLLECTION_IDS } from '../resources/service';

const router = Router({ mergeParams: true });

router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      unauthorized(res, 'Authentication required');
      return;
    }
    const userId = req.user.id;
    ok(res, { projects: await listProjectsForUser(userId) });
  } catch (error) {
    logger.error({ msg: 'List projects error', error });
    sendInternalError(res, 'Failed to load projects');
  }
});

router.post(
  '/',
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('slug').trim().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9-]+$/),
    body('repoUrl').optional().custom(validateProjectRepoUrl),
    body('description').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.mapped());
        return;
      }

      const { name, slug, repoUrl, description, repoProvider = 'github' } = req.body;
      if (!req.user) {
        unauthorized(res, 'Authentication required');
        return;
      }
      const userId = req.user.id;

      if (!(await ensureProjectSlugAvailable(slug))) {
        conflict(res, 'This slug is already taken', 'SLUG_EXISTS');
        return;
      }

      const project = await createProjectWithOwner({ name, slug, repoUrl, description, repoProvider }, userId);

      created(res, { project });
      queueProjectConfigBootstrap(project.id);
    } catch (error) {
      logger.error({ msg: 'Create project error', error });
      sendInternalError(res, 'Failed to create project');
    }
  },
);

router.get(
  '/:projectId',
  [param('projectId').isUUID()],
  requirePermission('collections', 'read'),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const project = await findProjectByIdWithMemberCount(projectId);

      if (!project) {
        sendNotFound(res);
        return;
      }

      ok(res, {
        project,
        settingsResourceCollectionId: RESOURCE_COLLECTION_IDS.settings,
      });
    } catch (error) {
      logger.error({ msg: 'Get project error', error });
      sendInternalError(res, 'Failed to load project');
    }
  },
);

router.patch(
  '/:projectId',
  [param('projectId').isUUID()],
  requireOwnerOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!(await ensureResourceNotLocked(req, res, {
        projectId,
        resourceType: 'projectSettings',
        resourceId: 'project-settings',
      }))) {
        return;
      }
      const { name, description, settings } = req.body;

      const existingProject = await findProjectSettings(projectId);

      if (!existingProject) {
        sendNotFound(res);
        return;
      }

      const sanitizedSettings = settings
        ? sanitizeProjectSettingsOrRespond(res, settings, existingProject.settings)
        : undefined;
      if (sanitizedSettings === null) return;

      const project = await updateProjectRecord(projectId, { name, description, settings: sanitizedSettings });

      await saveProjectConfigToGit(project, req.user);

      ok(res, { project });
    } catch (error) {
      logger.error({ msg: 'Update project error', error });
      sendInternalError(res, 'Failed to update project');
    }
  },
);

router.delete(
  '/:projectId',
  [param('projectId').isUUID()],
  requireOwnerOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!(await ensureResourceNotLocked(req, res, {
        projectId,
        resourceType: 'projectSettings',
        resourceId: 'project-settings',
      }))) {
        return;
      }
      if (!req.user) {
        unauthorized(res, 'Authentication required');
        return;
      }
      const userId = req.user.id;

      if (!(await ensureOwnerProjectDeleteAccess(userId, projectId, res))) {
        return;
      }

      await deleteProject(projectId);
      ok(res, { message: 'Project deleted successfully' });
    } catch (error) {
      logger.error({ msg: 'Delete project error', error });
      sendInternalError(res, 'Failed to delete project');
    }
  },
);

export default router;
