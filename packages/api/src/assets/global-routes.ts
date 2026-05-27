import { Router, type Request, type Response } from 'express';
import { normalizeAssetMetadata } from '@ori/shared';
import * as fs from 'fs';
import * as path from 'path';
import mime from 'mime-types';
import { requirePermission } from '../permissions/middleware';
import { logger } from '../middleware/logger';
import { badRequest, created, internalError, notFound, ok, unauthorized } from '../lib/responses';
import { GlobalAssetService } from './global-service';
import { query, validationResult } from 'express-validator';

const router = Router({ mergeParams: true });
const globalAssetService = new GlobalAssetService();

function getCommitAuthor(req: Request) {
  if (!req.user) {
    return null;
  }
  return {
    name: req.user.name || 'Unknown',
    email: req.user.email || 'unknown@example.com',
  };
}

router.get(
  '/raw/:assetId(*)',
  requirePermission('assets', 'read'),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const assetId = req.params.assetId;
      const fullPath = await globalAssetService.getAbsoluteAssetPath(projectId, assetId);

      if (!fullPath || !fs.existsSync(fullPath)) {
        notFound(res, 'Global asset not found');
        return;
      }

      const contentType = mime.lookup(fullPath) || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
    } catch (error) {
      logger.error({ msg: 'Global raw asset error', error });
      internalError(res, 'Failed to serve global asset', 'ASSET_ERROR');
    }
  },
);

router.get(
  '/',
  requirePermission('assets', 'read'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        badRequest(res, 'Invalid pagination parameters', 'INVALID_PARAMS');
        return;
      }

      const { projectId } = req.params;
      const page = typeof req.query.page === 'number' ? req.query.page : 1;
      const limit = Math.min(typeof req.query.limit === 'number' ? req.query.limit : 50, 100);
      const { assets: allAssets } = await globalAssetService.listAssets(projectId);
      const total = allAssets.length;
      const start = (page - 1) * limit;
      const assets = allAssets.slice(start, start + limit);

      ok(res, {
        assets,
        pagination: { page, limit, total, pageCount: Math.ceil(total / limit) },
      });
    } catch (error) {
      logger.error({ msg: 'List global assets error', error });
      internalError(res, 'Failed to list global assets', 'ASSET_ERROR');
    }
  },
);

router.post(
  '/upload',
  requirePermission('assets', 'create'),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { filename, content, folder = 'images', virtualFolder, tags } = req.body;

      if (!filename || !content) {
        badRequest(res, 'Filename and content are required', 'MISSING_DATA');
        return;
      }

      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.pdf'];
      const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      if (!allowedExtensions.includes(ext)) {
        badRequest(res, `File type not allowed. Allowed: ${allowedExtensions.join(', ')}`, 'INVALID_TYPE');
        return;
      }

      if (!content.match(/^data:[a-zA-Z0-9/+.-]+;base64,/)) {
        badRequest(res, 'Content must be base64 encoded data URL', 'INVALID_FORMAT');
        return;
      }

      const author = getCommitAuthor(req);
      if (!author) {
        unauthorized(res, 'Authentication required');
        return;
      }
      const asset = await globalAssetService.uploadAsset(
        projectId,
        String(folder),
        filename,
        content,
        Array.isArray(tags) && tags.length > 0
          ? normalizeAssetMetadata({ tags: tags.map((entry: unknown) => String(entry).trim()).filter(Boolean) })
          : virtualFolder
            ? normalizeAssetMetadata({ tags: [String(virtualFolder).trim()] })
            : undefined,
        {
          author,
          message: `Upload global asset ${path.basename(filename)}`,
        },
      );

      created(res, { asset });
    } catch (error) {
      logger.error({ msg: 'Upload global asset error', error });
      internalError(res, 'Failed to upload global asset', 'UPLOAD_ERROR');
    }
  },
);

router.put(
  '/metadata/:assetId(*)',
  requirePermission('assets', 'update'),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const assetId = req.params.assetId;
      const metadata = normalizeAssetMetadata((req.body ?? {}) as Record<string, unknown>);
      const author = getCommitAuthor(req);
      if (!author) {
        unauthorized(res, 'Authentication required');
        return;
      }
      const asset = await globalAssetService.updateMetadata(projectId, assetId, metadata, {
        author,
        message: `Update global asset metadata ${path.basename(assetId)}`,
      });

      ok(res, { asset, metadata: asset.metadata ?? {} });
    } catch (error) {
      logger.error({ msg: 'Update global asset metadata error', error });
      internalError(res, 'Failed to update global asset metadata', 'ASSET_ERROR');
    }
  },
);

router.get(
  '/:assetId(*)',
  requirePermission('assets', 'read'),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const assetId = req.params.assetId;
      const asset = await globalAssetService.getAsset(projectId, assetId);

      if (!asset) {
        notFound(res, 'Global asset not found');
        return;
      }

      ok(res, { asset });
    } catch (error) {
      logger.error({ msg: 'Get global asset error', error });
      internalError(res, 'Failed to get global asset', 'ASSET_ERROR');
    }
  },
);

router.delete(
  '/:assetId(*)',
  requirePermission('assets', 'delete'),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const assetId = req.params.assetId;
      const author = getCommitAuthor(req);
      if (!author) {
        unauthorized(res, 'Authentication required');
        return;
      }
      await globalAssetService.deleteAsset(projectId, assetId, {
        author,
        message: `Delete global asset ${path.basename(assetId)}`,
      });

      ok(res, { deleted: true });
    } catch (error) {
      logger.error({ msg: 'Delete global asset error', error });
      internalError(res, 'Failed to delete global asset', 'ASSET_ERROR');
    }
  },
);

export default router;
