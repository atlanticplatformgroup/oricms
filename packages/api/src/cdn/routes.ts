import { Router, Request, Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import {
  badRequest,
  internalError,
  normalizeValidationDetails,
  notFound,
  ok,
  validationError,
} from '../lib/responses';
import { logger } from '../middleware/logger';
import {
  CdnRouteError,
  createCdnExportJob,
  deleteCdnConfig,
  findCdnConfig,
  findCdnExport,
  listCdnExports,
  markCdnExportUploading,
  requireProject,
  resolveExportSourcePath,
  sanitizeCdnConfig,
  saveCdnConfig,
  scheduleCdnExport,
  toStorageConfig,
} from './route-support';

const router = Router({ mergeParams: true });

router.get('/config', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const config = await findCdnConfig(projectId);

    if (!config) {
      notFound(res, 'CDN not configured for this project', 'NOT_CONFIGURED');
      return;
    }

    ok(res, sanitizeCdnConfig(config));
  } catch (error) {
    logger.error({ msg: 'Get CDN config error', error });
    internalError(res, 'Failed to load CDN configuration');
  }
});

router.post(
  '/config',
  [
    param('projectId').isUUID(),
    body('provider').isIn(['s3', 'r2', 'minio']),
    body('bucket').trim().notEmpty(),
    body('accessKeyId').trim().notEmpty(),
    body('secretAccessKey').trim().notEmpty(),
    body('region').optional().trim(),
    body('endpoint').optional().trim().isURL(),
    body('baseUrl').optional().trim().isURL(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
        return;
      }

      const { projectId } = req.params;
      const {
        provider,
        bucket,
        accessKeyId,
        secretAccessKey,
        region,
        endpoint,
        baseUrl,
      } = req.body;

      await requireProject(projectId);
      const config = await saveCdnConfig(projectId, {
        provider,
        bucket,
        accessKeyId,
        secretAccessKey,
        region,
        endpoint,
        baseUrl,
      });

      ok(res, sanitizeCdnConfig(config));
    } catch (error) {
      if (error instanceof CdnRouteError) {
        notFound(res, error.message, error.code);
        return;
      }
      logger.error({ msg: 'Configure CDN error', error });
      internalError(res, 'Failed to configure CDN');
    }
  }
);

router.post(
  '/export',
  [
    param('projectId').isUUID(),
    body('buildId').optional().isUUID(),
    body('destinationPrefix').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
        return;
      }

      const { projectId } = req.params;
      const { buildId, destinationPrefix } = req.body;

      const config = await findCdnConfig(projectId);

      if (!config) {
        badRequest(res, 'CDN not configured for this project', 'CDN_NOT_CONFIGURED');
        return;
      }

      const storageConfig = toStorageConfig(config);
      const exportSource = await resolveExportSourcePath(projectId, buildId);
      const exportJob = await createCdnExportJob(projectId, {
        buildId: buildId ?? exportSource.buildId,
        sourcePath: exportSource.sourcePath,
        destinationPrefix,
      });
      await markCdnExportUploading(exportJob.id);
      scheduleCdnExport({
        exportId: exportJob.id,
        projectId,
        storageConfig,
        sourcePath: exportSource.sourcePath,
        destinationPrefix,
      });

      ok(res, {
        exportId: exportJob.id,
        status: exportJob.status,
        message: 'Export started',
      });
    } catch (error) {
      if (error instanceof CdnRouteError) {
        badRequest(res, error.message, error.code);
        return;
      }
      logger.error({ msg: 'Export error', error });
      internalError(res, 'Failed to start export');
    }
  }
);

router.get('/exports', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    ok(res, await listCdnExports(projectId, limit, offset));
  } catch (error) {
    logger.error({ msg: 'List exports error', error });
    internalError(res, 'Failed to load exports');
  }
});

router.get('/exports/:exportId', async (req: Request, res: Response) => {
  try {
    const { projectId, exportId } = req.params;

    const exportJob = await findCdnExport(projectId, exportId);

    if (!exportJob) {
      notFound(res, 'Export not found');
      return;
    }

    ok(res, { export: exportJob });
  } catch (error) {
    logger.error({ msg: 'Get export error', error });
    internalError(res, 'Failed to load export');
  }
});

router.delete('/config', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    await deleteCdnConfig(projectId);

    ok(res, { message: 'CDN configuration removed' });
  } catch (error) {
    logger.error({ msg: 'Delete CDN config error', error });
    internalError(res, 'Failed to remove CDN configuration');
  }
});

export default router;
