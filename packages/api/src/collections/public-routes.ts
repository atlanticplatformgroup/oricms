/**
 * Public Collections Routes - Read-only delivery API without auth
 *
 * Endpoints:
 * GET /api/v1/delivery/projects/:projectId/collections/:type
 * GET /api/v1/delivery/projects/:projectId/collections/:type/:id
 */

import { Router, type Request, type Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import {
  badRequest,
  internalError,
  normalizeValidationDetails,
  notFound,
  ok,
  serviceUnavailable,
  unauthorized,
  validationError,
} from '../lib/responses';
import type { CollectionQuery } from '@ori/shared';
import crypto from 'crypto';
import { DeliveryProjectionService } from '../delivery-projection/service';

const router = Router({ mergeParams: true });
const DELIVERY_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

function getDeliveryApiKey(req: { headers: Record<string, unknown> }): string | null {
  const directHeader = req.headers['x-oricms-delivery-key'];
  if (typeof directHeader === 'string' && directHeader.trim()) {
    return directHeader.trim();
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

function createEtag(input: string): string {
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  return `"${hash}"`;
}

function matchesIfNoneMatch(ifNoneMatch: unknown, etag: string): boolean {
  if (typeof ifNoneMatch !== 'string') return false;
  return ifNoneMatch
    .split(',')
    .map((value) => value.trim())
    .some((candidate) => candidate === etag || candidate === '*');
}

/**
 * GET /api/v1/delivery/projects/:projectId/collections/:type
 * Public list endpoint (read-only)
 */
router.get(
  '/:type',
  [
    param('projectId').isUUID(),
    param('type').trim().notEmpty(),
    query('filter').optional().isJSON(),
    query('sort').optional().isJSON(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('populate').optional().trim(),
    query('search').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
        return;
      }

      const { projectId, type } = req.params as { projectId: string; type: string };

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        notFound(res, 'Project not found', 'PROJECT_NOT_FOUND');
        return;
      }

      const settings = (project.settings || {}) as Record<string, unknown>;
      const requireDeliveryApiKey = settings.requireDeliveryApiKey ?? true;
      const deliveryApiKeyHash = settings.deliveryApiKeyHash as string | undefined;

      if (requireDeliveryApiKey) {
        if (!deliveryApiKeyHash) {
          serviceUnavailable(res, 'Delivery API key is not configured', 'DELIVERY_KEY_NOT_CONFIGURED');
          return;
        }

        const providedKey = getDeliveryApiKey(req);
        if (!providedKey) {
          unauthorized(res, 'Delivery API key is required', 'MISSING_DELIVERY_KEY');
          return;
        }

        const providedHash = crypto.createHash('sha256').update(providedKey).digest('hex');
        const expectedBuffer = Buffer.from(deliveryApiKeyHash, 'hex');
        const providedBuffer = Buffer.from(providedHash, 'hex');

        if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
          unauthorized(res, 'Invalid delivery API key', 'INVALID_DELIVERY_KEY');
          return;
        }
      }

      const queryParams: CollectionQuery = {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        populate: req.query.populate as string | undefined,
        search: req.query.search as string | undefined,
      };

      if (req.query.filter) {
        try {
          queryParams.filter = JSON.parse(req.query.filter as string);
        } catch {
          badRequest(res, 'Filter must be valid JSON', 'INVALID_FILTER');
          return;
        }
      }

      if (req.query.sort) {
        try {
          queryParams.sort = JSON.parse(req.query.sort as string);
        } catch {
          badRequest(res, 'Sort must be valid JSON', 'INVALID_SORT');
          return;
        }
      }

      const projectionService = new DeliveryProjectionService({
        projectId,
        repoUrl: project.repoUrl ?? '',
        branch: project.defaultBranch,
      });
      const snapshot = await projectionService.ensureCurrent();

      const page = queryParams.page || 1;
      const limit = Math.min(queryParams.limit || 20, 100);
      const cacheKey = JSON.stringify({
        projectId,
        type,
        revision: snapshot.revision,
        query: {
          ...queryParams,
          page,
          limit,
        },
      });
      const etag = createEtag(cacheKey);

      res.setHeader('Cache-Control', DELIVERY_CACHE_CONTROL);
      res.setHeader('ETag', etag);
      if (matchesIfNoneMatch(req.headers['if-none-match'], etag)) {
        res.status(304).end();
        return;
      }

      const result = await projectionService.listRecords(type, queryParams);

      ok(res, result);
    } catch (error) {
      logger.error({ msg: 'Public list collection records error', error });
      internalError(res, error instanceof Error ? error.message : 'Failed to load records');
    }
  }
);

/**
 * GET /api/v1/delivery/projects/:projectId/collections/:type/:id
 * Public record endpoint (read-only)
 */
router.get(
  '/:type/:id',
  [
    param('projectId').isUUID(),
    param('type').trim().notEmpty(),
    param('id').trim().notEmpty(),
    query('populate').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        validationError(res, 'Invalid input', normalizeValidationDetails(errors.mapped()));
        return;
      }

      const { projectId, type, id } = req.params as { projectId: string; type: string; id: string };
      const populate = req.query.populate as string | undefined;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        notFound(res, 'Project not found', 'PROJECT_NOT_FOUND');
        return;
      }

      const settings = (project.settings || {}) as Record<string, unknown>;
      const requireDeliveryApiKey = settings.requireDeliveryApiKey ?? true;
      const deliveryApiKeyHash = settings.deliveryApiKeyHash as string | undefined;

      if (requireDeliveryApiKey) {
        if (!deliveryApiKeyHash) {
          serviceUnavailable(res, 'Delivery API key is not configured', 'DELIVERY_KEY_NOT_CONFIGURED');
          return;
        }

        const providedKey = getDeliveryApiKey(req);
        if (!providedKey) {
          unauthorized(res, 'Delivery API key is required', 'MISSING_DELIVERY_KEY');
          return;
        }

        const providedHash = crypto.createHash('sha256').update(providedKey).digest('hex');
        const expectedBuffer = Buffer.from(deliveryApiKeyHash, 'hex');
        const providedBuffer = Buffer.from(providedHash, 'hex');

        if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
          unauthorized(res, 'Invalid delivery API key', 'INVALID_DELIVERY_KEY');
          return;
        }
      }

      const projectionService = new DeliveryProjectionService({
        projectId,
        repoUrl: project.repoUrl ?? '',
        branch: project.defaultBranch,
      });
      const snapshot = await projectionService.ensureCurrent();
      const etag = createEtag(JSON.stringify({
        projectId,
        type,
        id,
        populate: populate || null,
        revision: snapshot.revision,
      }));

      res.setHeader('Cache-Control', DELIVERY_CACHE_CONTROL);
      res.setHeader('ETag', etag);
      if (matchesIfNoneMatch(req.headers['if-none-match'], etag)) {
        res.status(304).end();
        return;
      }

      const record = await projectionService.getRecord(type, id, populate);

      if (!record) {
        notFound(res, 'Record not found');
        return;
      }

      ok(res, { record });
    } catch (error) {
      logger.error({ msg: 'Public get collection record error', error });
      internalError(res, error instanceof Error ? error.message : 'Failed to load record');
    }
  }
);

export default router;
