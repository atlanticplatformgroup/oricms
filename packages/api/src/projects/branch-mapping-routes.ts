import { Router, type Request, type Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import { ensureResourceNotLocked } from '../locks/middleware';
import { conflict, notFound } from '../lib/responses';
import { requireOwnerOrAdmin, requirePermission } from '../permissions/middleware';
import { extractProjectEnvironments } from './settings';
import { sendInternalError, sendNotFound, sendValidationError } from './shared';

const router = Router({ mergeParams: true });

function buildDefaultMappings(settings: Prisma.JsonValue | null) {
  const environments = extractProjectEnvironments(settings);
  const productionEnv = environments.find((env) => env.type === 'live' || env.name?.toLowerCase() === 'production');
  const stagingEnv = environments.find((env) => env.name?.toLowerCase() === 'staging');

  return [
    { branchPattern: 'main', environmentId: productionEnv?.id || null, autoDeploy: true, deployOnMerge: false },
    { branchPattern: 'staging', environmentId: stagingEnv?.id || productionEnv?.id || null, autoDeploy: true, deployOnMerge: true },
  ];
}

router.get('/:projectId/branch-mappings', [param('projectId').isUUID()], requirePermission('collections', 'read'), async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const [project, mappings] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, select: { id: true, settings: true } }),
      prisma.branchEnvironmentMapping.findMany({ where: { projectId }, orderBy: { branchPattern: 'asc' } }),
    ]);

    if (!project) {
      sendNotFound(res);
      return;
    }

    res.json({ success: true, data: { mappings, defaults: buildDefaultMappings(project.settings as Prisma.JsonValue) } });
  } catch (error) {
    logger.error({ msg: 'List branch mappings error', error });
    sendInternalError(res, 'Failed to load branch mappings');
  }
});

router.post('/:projectId/branch-mappings/initialize-defaults', [param('projectId').isUUID()], requireOwnerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    if (!(await ensureResourceNotLocked(req, res, {
      projectId,
      resourceType: 'projectSettings',
      resourceId: 'branch-settings',
    }))) {
      return;
    }
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, settings: true } });
    if (!project) {
      sendNotFound(res);
      return;
    }

    const defaults = buildDefaultMappings(project.settings as Prisma.JsonValue);
    for (const mapping of defaults) {
      await prisma.branchEnvironmentMapping.upsert({
        where: { projectId_branchPattern: { projectId, branchPattern: mapping.branchPattern } },
        create: { projectId, ...mapping },
        update: { environmentId: mapping.environmentId, autoDeploy: mapping.autoDeploy, deployOnMerge: mapping.deployOnMerge },
      });
    }

    const mappings = await prisma.branchEnvironmentMapping.findMany({ where: { projectId }, orderBy: { branchPattern: 'asc' } });
    res.json({ success: true, data: { mappings } });
  } catch (error) {
    logger.error({ msg: 'Initialize default branch mappings error', error });
    sendInternalError(res, 'Failed to initialize default branch mappings');
  }
});

router.post(
  '/:projectId/branch-mappings',
  [param('projectId').isUUID(), body('branchPattern').trim().isLength({ min: 1, max: 100 }), body('environmentId').optional({ nullable: true }).isString(), body('autoDeploy').optional().isBoolean(), body('deployOnMerge').optional().isBoolean()],
  requireOwnerOrAdmin,
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
        resourceId: 'branch-settings',
      }))) {
        return;
      }
      const { branchPattern, environmentId, autoDeploy = false, deployOnMerge = false } = req.body;
      const mapping = await prisma.branchEnvironmentMapping.create({
        data: { projectId, branchPattern, environmentId: environmentId || null, autoDeploy, deployOnMerge },
      });

      res.status(201).json({ success: true, data: { mapping } });
    } catch (error) {
      logger.error({ msg: 'Create branch mapping error', error });
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        conflict(res, 'A mapping for this branch pattern already exists', 'MAPPING_EXISTS');
        return;
      }
      sendInternalError(res, 'Failed to create branch mapping');
    }
  },
);

router.patch(
  '/:projectId/branch-mappings/:mappingId',
  [param('projectId').isUUID(), param('mappingId').isUUID(), body('branchPattern').optional().trim().isLength({ min: 1, max: 100 }), body('environmentId').optional({ nullable: true }).isString(), body('autoDeploy').optional().isBoolean(), body('deployOnMerge').optional().isBoolean()],
  requireOwnerOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        sendValidationError(res, errors.mapped());
        return;
      }

      const { projectId, mappingId } = req.params;
      if (!(await ensureResourceNotLocked(req, res, {
        projectId,
        resourceType: 'projectSettings',
        resourceId: 'branch-settings',
      }))) {
        return;
      }
      const existing = await prisma.branchEnvironmentMapping.findFirst({ where: { id: mappingId, projectId } });
      if (!existing) {
        notFound(res, 'Branch mapping not found');
        return;
      }

      const mapping = await prisma.branchEnvironmentMapping.update({
        where: { id: mappingId },
        data: {
          ...(req.body.branchPattern !== undefined ? { branchPattern: req.body.branchPattern } : {}),
          ...(req.body.environmentId !== undefined ? { environmentId: req.body.environmentId || null } : {}),
          ...(req.body.autoDeploy !== undefined ? { autoDeploy: req.body.autoDeploy } : {}),
          ...(req.body.deployOnMerge !== undefined ? { deployOnMerge: req.body.deployOnMerge } : {}),
        },
      });

      res.json({ success: true, data: { mapping } });
    } catch (error) {
      logger.error({ msg: 'Update branch mapping error', error });
      sendInternalError(res, 'Failed to update branch mapping');
    }
  },
);

router.delete('/:projectId/branch-mappings/:mappingId', [param('projectId').isUUID(), param('mappingId').isUUID()], requireOwnerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId, mappingId } = req.params;
    if (!(await ensureResourceNotLocked(req, res, {
      projectId,
      resourceType: 'projectSettings',
      resourceId: 'branch-settings',
    }))) {
      return;
    }
    const existing = await prisma.branchEnvironmentMapping.findFirst({ where: { id: mappingId, projectId } });
    if (!existing) {
      notFound(res, 'Branch mapping not found');
      return;
    }

    await prisma.branchEnvironmentMapping.delete({ where: { id: mappingId } });
    res.json({ success: true, data: { message: 'Branch mapping deleted' } });
  } catch (error) {
    logger.error({ msg: 'Delete branch mapping error', error });
    sendInternalError(res, 'Failed to delete branch mapping');
  }
});

export default router;
