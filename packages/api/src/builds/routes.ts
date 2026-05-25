import { Router, Request, Response } from 'express';
import { param, query, body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import { badRequest, internalError, normalizeValidationDetails, notFound, ok, validationError } from '../lib/responses';
import {
  buildStatusUpdateData,
  canCancelBuild,
  createManualBuild,
  findBuildForProject,
  findBuildProject,
  listBuildsForProject,
  queueManualBuild,
  summarizeBuildStatus,
  toBuildDetailResponse,
} from './build-route-support';

const router = Router({ mergeParams: true });

router.get(
  '/',
  [
    param('projectId').isUUID(),
    query('status').optional().isIn(['pending', 'running', 'success', 'failed', 'cancelled']),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
        return;
      }

      const { projectId } = req.params;
      const status = req.query.status as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      ok(res, await listBuildsForProject(projectId, { status, limit, offset }));
    } catch (error) {
      logger.error({ msg: 'List builds error', error });
      internalError(res, 'Failed to load builds');
    }
  }
);

router.get(
  '/:buildId',
  [
    param('projectId').isUUID(),
    param('buildId').isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input');
        return;
      }

      const { projectId, buildId } = req.params;

      const build = await findBuildForProject(projectId, buildId);

      if (!build) {
        notFound(res, 'Build not found', 'BUILD_NOT_FOUND');
        return;
      }

      ok(res, toBuildDetailResponse(build));
    } catch (error) {
      logger.error({ msg: 'Get build error', error });
      internalError(res, 'Failed to load build');
    }
  }
);

router.post(
  '/',
  [
    param('projectId').isUUID(),
    body('branch').optional().trim(),
    body('commit').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input');
        return;
      }

      const { projectId } = req.params;
      const branch = req.body.branch || 'main';
      const commit = req.body.commit;

      const project = await findBuildProject(projectId);

      if (!project) {
        notFound(res, 'Project not found', 'PROJECT_NOT_FOUND');
        return;
      }

      const build = await createManualBuild(projectId, {
        branch,
        commit,
        actorEmail: req.user?.email,
      });

      await queueManualBuild(build.id, projectId, {
        branch,
        commit,
        repoUrl: project.repoUrl,
      });

      ok(res, {
        build,
        message: 'Build triggered successfully',
      });
    } catch (error) {
      logger.error({ msg: 'Trigger build error', error });
      internalError(res, 'Failed to trigger build');
    }
  }
);

router.post(
  '/:buildId/cancel',
  [
    param('projectId').isUUID(),
    param('buildId').isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input');
        return;
      }

      const { projectId, buildId } = req.params;

      const build = await findBuildForProject(projectId, buildId);

      if (!build) {
        notFound(res, 'Build not found', 'BUILD_NOT_FOUND');
        return;
      }

      if (!canCancelBuild(build.status)) {
        badRequest(res, `Cannot cancel build with status: ${build.status}`, 'CANNOT_CANCEL');
        return;
      }

      const cancelledBuild = await prisma.build.update({
        where: { id: buildId },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
        },
      });

      ok(res, {
        build: cancelledBuild,
        message: 'Build cancelled',
      });
    } catch (error) {
      logger.error({ msg: 'Cancel build error', error });
      internalError(res, 'Failed to cancel build');
    }
  }
);

router.patch(
  '/:buildId',
  [
    param('projectId').isUUID(),
    param('buildId').isUUID(),
    body('status').isIn(['pending', 'running', 'success', 'failed', 'cancelled']),
    body('logs').optional().isString(),
    body('duration').optional().isInt(),
    body('outputUrl').optional().isURL(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input');
        return;
      }

      const { projectId, buildId } = req.params;
      const { status, logs, duration, outputUrl } = req.body;

      const build = await findBuildForProject(projectId, buildId);

      if (!build) {
        notFound(res, 'Build not found', 'BUILD_NOT_FOUND');
        return;
      }

      const updateData = buildStatusUpdateData(build, { status, logs, duration, outputUrl });
      const updated = await prisma.build.update({
        where: { id: buildId },
        data: updateData,
      });

      ok(res, { build: updated });
    } catch (error) {
      logger.error({ msg: 'Update build error', error });
      internalError(res, 'Failed to update build');
    }
  }
);

router.get(
  '/status/summary',
  [
    param('projectId').isUUID(),
  ],
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      ok(res, await summarizeBuildStatus(projectId));
    } catch (error) {
      logger.error({ msg: 'Build status summary error', error });
      internalError(res, 'Failed to load build status');
    }
  }
);

export default router;
