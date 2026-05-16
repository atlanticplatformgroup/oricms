import { Router, type Request } from 'express';
import { normalizeAssetMetadata } from '@ori/shared';
import * as fs from 'fs';
import * as path from 'path';
import mime from 'mime-types';
import { requirePermission } from '../permissions/middleware';
import { logger } from '../middleware/logger';
import { badRequest, created, internalError, notFound, ok } from '../lib/responses';
import { GlobalAssetService } from './global-service';

const router = Router({ mergeParams: true });
const globalAssetService = new GlobalAssetService();

function getCommitAuthor(req: Request) {
  const user = req.user!;
  return {
    name: user.name || 'Unknown',
    email: user.email || 'unknown@example.com',
  };
}

router.get(
  '/raw/:assetId(*)',
  requirePermission('assets', 'read'),
  async (req, res) => {
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
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const result = await globalAssetService.listAssets(projectId);
      ok(res, result);
    } catch (error) {
      logger.error({ msg: 'List global assets error', error });
      internalError(res, 'Failed to list global assets', 'ASSET_ERROR');
    }
  },
);

router.post(
  '/upload',
  requirePermission('assets', 'create'),
  async (req, res) => {
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
          author: getCommitAuthor(req),
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
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const assetId = req.params.assetId;
      const metadata = normalizeAssetMetadata((req.body ?? {}) as Record<string, unknown>);
      const asset = await globalAssetService.updateMetadata(projectId, assetId, metadata, {
        author: getCommitAuthor(req),
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
  async (req, res) => {
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
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const assetId = req.params.assetId;
      await globalAssetService.deleteAsset(projectId, assetId, {
        author: getCommitAuthor(req),
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
